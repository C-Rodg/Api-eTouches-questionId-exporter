var Promise = require('bluebird'),
	http 	= require('https'),
	fs 		= require('fs'),
	parseString  = require('xml2js').parseString;

var c_ACCOUNT_ID = "", 					// CHANGE
	c_API_KEY 	 = "",  				// CHANGE
	c_EVENT_ID 	 = "",					// CHANGE
	loginToken 	 = "";

var get_URL = "https://www.eiseverywhere.com/api/v2/ereg/",
	login_URL = "https://www.eiseverywhere.com/api/v2/global/";

function login() {
	return new Promise(function (resolve, reject) {
		var request = login_URL + 'authorize.xml?accountid=' + c_ACCOUNT_ID + '&key=' + c_API_KEY;
		http.get(request, function(res) {
			var data = "";
			res.on('data', function(chunk) {
				data += chunk;
			});
			res.on('end', function() {
				resolve(data);
			});
		});
	});
}

function listAttendees(token) {
	return new Promise(function(resolve, reject) {
		var request = get_URL + 'listAttendees.xml?accesstoken=' + token + '&eventid=' + c_EVENT_ID;
		http.get(request, function(res) {
			var data = '';
			res.on('data', function(chunk) {
				data += chunk;
			});
			res.on('end', function() {
				resolve(data);
			});
		});
	});
}

function parseToken(str) {
	return new Promise(function(resolve, reject) {
		parseString(str, function(err, result) {
			resolve(result.etouches.accesstoken[0]);
		});
	});
}

function parseAttendees(atRequest) {
	return new Promise(function(resolve, reject) {
		parseString(atRequest, function(err, result) {
			resolve(result.etouches.item);
		});
	});
}

function listIds(atList) {
	return new Promise(function(resolve, reject) {
		var attendeeArray = atList.map(function(person) {
			return person.attendeeid[0];
		});
		resolve(attendeeArray);
	});
}

function getPerson(id) {
	return new Promise(function(resolve, reject) {
		var request = get_URL + 'getAttendee.xml?accesstoken=' + loginToken + '&eventid=' + c_EVENT_ID + '&attendeeid=' + id;
		http.get(request, function(res) {
			var data = '';
			res.on('data', function(chunk) {
				data += chunk;
			});
			res.on('end', function() {
				resolve(data);
			});
		});
	});
}

function getRegistrants(idList) {	
	return new Promise(function(resolve, reject) {
		var requests = [];
		for(var i = 0; i < idList.length; i++) {
			requests.push(getPerson(idList[i]));
		}

		Promise.all(requests).then(function(data) {
			resolve(data);
		});
	});
}

function convertPersonToJS(registrant) {
	return new Promise(function(resolve, reject) {
		parseString(registrant, function(err, result) {
			resolve(result);
		});
	});
}

function convertListFromXml(xmlRegistrants) {
	return new Promise(function(resolve, reject) {
		var parseRequests = [];
		for(var i = 0; i < xmlRegistrants.length; i++) {
			parseRequests.push(convertPersonToJS(xmlRegistrants[i]));
		}

		Promise.all(parseRequests).then(function(data) {
			resolve(data);
		});
	});
}

var tryToLocate = true;
function locateField(regList) {
	return new Promise(function(resolve, reject) {	
		var fieldName = "10433858";		
		if(tryToLocate) {
			console.log("The following people have values for fieldname - " + fieldName);
			regList.forEach(function(person) {
				var questionList = person.etouches.responses[0].item;
				questionList.forEach(function(question) {					
					if(question.fieldname[0] === fieldName) {
						console.log(person.etouches.attendeeid);
					}
				});
			});
		}		
		resolve(regList);
	});
}

function listResponses(regList) {
	return new Promise(function(resolve, reject) {
		var responsesList = regList.map(function(registrant) {
			return registrant.etouches.responses[0].item;
		});
		resolve(responsesList);
	});
}

function oneArray(responseList) {
	return new Promise(function(resolve, reject) {
		var flatArray = [].concat.apply([], responseList);
		resolve(flatArray);
	});
}

function selectFields(questionList) {
	return new Promise(function(resolve, reject) {
		var questionFieldList = questionList.map(function(question) {		
			return {
				fieldname : question.fieldname[0],
				name 	  : question.name[0]
			}
		});
		resolve(questionFieldList);
	});
}

function filterUnique(questions) {
	return new Promise(function(resolve, reject) {
		var arrObj = {};
		var unique = [];
		for(var i = 0, len = questions.length; i < len; i++) {
			arrObj[questions[i]['fieldname']] = questions[i];
		}
		for (var key in arrObj) {
			unique.push(arrObj[key]);
		}
		resolve(unique);
	});
}

function logQuestions(list) {
	return new Promise(function(resolve, reject) {
		var printStr = '';
		list.forEach(function(item) {
			printStr += "FIELDNAME: " + item.fieldname + "\n";
			printStr += "QUESTION TITLE: " + item.name + "\n\n";
		});
		fs.writeFile("questionList.txt", printStr, function(err, res) {
			resolve(printStr);
		});
	});
}

login().then(function(req) {
	return parseToken(req);
}).then(function(token) {
	loginToken = token;
	return listAttendees(token);
}).then(function(attendeeRequest) {
	return parseAttendees(attendeeRequest);
}).then(function(attendeeList) {
	return listIds(attendeeList);
}).then(function(idList) {
	return getRegistrants(idList);
}).then(function(xmlRegistrants) {
	return convertListFromXml(xmlRegistrants);
}).then(function(personList) { 
	return locateField(personList);
}).then(function(jsonRegistrants) {
	return listResponses(jsonRegistrants);
}).then(function(responseList) {
	return oneArray(responseList);
}).then(function(questionList) {
	return selectFields(questionList);
}).then(function(questions) {
	return filterUnique(questions);
}).then(function(uniqueList) {
	return logQuestions(uniqueList);
}).then(function(printStr) {
	console.log("Done!");
})