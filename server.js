const http = require("http"),
	fs = require("fs"),
	// IMPORTANT: you must run `npm install` in the directory for this assignment
	// to install the mime library if you're testing this on your local machine.
	// On Render, make sure `npm install` is your build command.
	mime = require("mime"),
	dir = "public/",
	port = 3000;

const appdata = {
	times: [
		{ name: "Sample", ms: 309, time: 0 },
		{ name: "Sample", ms: 264, time: 1 },
		{ name: "Sample", ms: 402, time: 2 },
	],
	averages: { Sample: { name: "Sample", n: 3, tot: 975, avg: 325 } },
};

const server = http.createServer(function (request, response) {
	if (request.method === "GET") {
		handleGet(request, response);
	} else if (request.method === "POST") {
		handlePost(request, response);
	} else if (request.method === "DELETE") {
		handleDelete(request, response);
	} else if (request.method === "PUT") {
		handlePut(request, response);
	}
});

const handleGet = function (request, response) {
	const filename = dir + request.url.slice(1);

	if (request.url === "/") {
		sendFile(response, "public/index.html");
	} else {
		sendFile(response, filename);
	}
};

const handlePost = function (request, response) {
	let dataString = "";

	request.on("data", function (data) {
		dataString += data;
	});

	request.on("end", function () {
		let data = JSON.parse(dataString);
		// console.log(data)
		if (data.name != "") {
			appdata.times.push(data);
			setAverages();
		}
		response.writeHead(200, "OK", { "Content-Type": "text/plain" });

		// change this to incorporate data
		response.end(JSON.stringify(appdata));
	});
};

const setAverages = function () {
	appdata.averages = {};
	console.log(appdata);
	for (const item of appdata.times) {
		let usrname = item.name;
		if (!(usrname in appdata.averages)) {
			appdata.averages[usrname] = { name: usrname, n: 0, tot: 0, avg: 0 };
		}
		avgData = appdata.averages[usrname];
		avgData.n++;
		avgData.tot += item.ms;
		avgData.avg = avgData.tot / avgData.n;
		// console.log("avg:" + JSON.stringify(avgData))
	}
	console.log(appdata.averages)
}

// structure 
// {
// 	"type" : "all" | "single", 
// 	"name" : "name"
// 	"timestamp" : "timestamp"
// }
const handleDelete = function (request, response) {
	let dataString = "";

	request.on("data", function (data) {
		dataString += data;
	});

	request.on("end", function () {
		let data = JSON.parse(dataString);
		// console.log(data)

		if (data.type === "all") {
			// console.log("Deleting All of " + data.name);
			delete appdata.averages[data.name];
			appdata.times = appdata.times.filter((time) => {
				return time.name != data.name;
			});
		} else if (data.type === "single") {
			// console.log("Deleting " + data.name + " with timestamp " + data.timestamp);
			appdata.times = appdata.times.filter((time) => {
				return time.time != data.timestamp;
			});
		}

		response.writeHead(200, "OK", { "Content-Type": "text/plain" });

		response.end(JSON.stringify(appdata));
	});
};

// { ms: ms, name: name, timestamp: timestamp }
const handlePut = function (request, response) {
	let dataString = "";

	request.on("data", function (data) {
		dataString += data;
	});

	request.on("end", function () {
		let data = JSON.parse(dataString);
		// console.log(data)
		// console.log(`Replacing ${data.name} timestamp ${data.timestamp} with ${data.ms} ms`);

		for (const item of appdata.times) {
			if (item.time === Number(data.timestamp)) {
				// console.log(`${data.ms} found, replacing ${item.ms}ms`)
				item.ms = data.ms;
				break;
			}
		}
		setAverages();
		response.writeHead(200, "OK", { "Content-Type": "text/plain" });

		response.end(JSON.stringify(appdata));
	});
};

const sendFile = function (response, filename) {
	const type = mime.getType(filename);

	fs.readFile(filename, function (err, content) {
		// if the error = null, then we've loaded the file successfully
		if (err === null) {
			// status code: https://httpstatuses.com
			response.writeHeader(200, { "Content-Type": type });
			response.end(content);
		} else {
			// file not found, error code 404
			response.writeHeader(404);
			response.end("404 Error: File Not Found");
		}
	});
};

server.listen(process.env.PORT || port);
