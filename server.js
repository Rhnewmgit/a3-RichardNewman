require("dotenv").config();

const express = require("express"),
	{ MongoClient, ServerApiVersion, ObjectId } = require("mongodb"),
	cookie = require("cookie-session"),
	// passport = require("passport-github2"),
	app = express();

const logger = (req, res, next) => {
	console.log("url:", req.url);
	next();
};

// app.use(logger);
app.use(express.urlencoded({ extended: true }))
app.use(
	cookie({
		name: "session",
		keys: ["kTFxJkGskcXfgVtf2AGA", "7wRwbXaFYan68rWw8pxW"],
	}),
);
app.use(express.json());
app.use(express.static("public"));

// passport.use(new GitHubStrategy({
// 	clientID: GITHUB_CLIENT_ID,
// 	clientSecret: GITHUB_CLIENT_SECRET,
// 	callbackURL: "http://127.0.0.1:3000/auth/github/callback"
// },
// 	function (accessToken, refreshToken, profile, done) {
// 		User.findOrCreate({ githubId: profile.id }, function (err, user) {
// 			return done(err, user);
// 		});
// 	}
// ));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}`;

let averagesCollection = null;
let timesCollection = null;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});



async function run() {
	await client.connect();
	// testCollection = await client.db("datatest").collection("test")
	timesCollection = await client.db("a3-RichardNewman-Data").collection("times");
	averagesCollection = await client.db("a3-RichardNewman-Data").collection("averages");
	userPassCollection = await client.db("a3-RichardNewman-Data").collection("userPass");

	// route to get all docs
	app.get("/docs", async (req, res) => {
		const user = req.session?.user;
		if (averagesCollection !== null && timesCollection !== null) {
			const docs = await getAllDocs(user);
			res.json(docs);
		}
	});
}

run();

async function getAllDocs(user) {
	const times = await timesCollection.find({ user }).toArray();
	const averages = await averagesCollection.find({ user }).toArray();
	const docs = { times, averages };
	return docs;
}

async function addSampleTimes(user) {
	const result = await timesCollection.insertMany([
		{ name: "Sample", ms: 309, user: user },
		{ name: "Sample", ms: 264, user: user },
		{ name: "Sample", ms: 402, user: user },
	]);
	return result;
}

/**
 * Clears the averages collection and rebuilds it based on the times collection
 * @returns the response to the insertion of the recalculated averages
 */
async function resetAverages(user) {
	await averagesCollection.deleteMany({ user });
	// averagesCollection = await client.db("a3-RichardNewman-Data").createCollection("averages");
	const agg = await timesCollection.aggregate(
		[
			{
				$match:
				{
					user
				}
			},
			{
				$group: {
					_id: "$name",
					n: { $sum: 1 },
					tot: { $sum: "$ms" },
				},
			},
			{
				$set: {
					avg: { $divide: ["$tot", "$n"] },
					name: "$_id",
					user
				},
			},
			{
				$unset: "_id",
			},
			{ $sort: { avg: -1 } }
		],
		{},
	);
	let averages = [];
	while (await agg.hasNext()) {
		averages.push(await agg.next());
	}
	if (averages.length === 0) {
		return;
	}
	const result = await averagesCollection.insertMany(averages);
	return result;
}

/**
 * Updates a singular average based on a single time object
 */
async function updateOneAverage(time, user) {
	const result = await averagesCollection.findOneAndUpdate(
		{ name: time.name, user },
		[
			{
				$set: {
					n: { $ifNull: ["$n", 0] },
					tot: { $ifNull: ["$tot", 0] },
				},
			},
			{
				$set: {
					n: { $add: ["$n", 1] },
					tot: { $add: ["$tot", time.ms] },
				},
			},
			{ $set: { avg: { $divide: ["$tot", "$n"] } } },
		],
		{
			upsert: true,
		},
	);
	return result;
}

app.post("/login", async (req, res) => {
	if (req.body === null || req.body === undefined || req.body.username === null || req.body.username.length < 4) {
		res.json(null);
		return;
	}
	const userPass = await userPassCollection.findOne({ username: req.body.username });

	if (userPass !== null && req.body.password === userPass.password && req.body.username != undefined) {
		// define a variable that we can check in other middleware
		// the session object is added to our requests by the cookie-session middleware
		req.session.login = true;
		req.session.user = req.body.username;
		console.log("User " + req.session.user + " logged in.");

		// since login was successful, send the user to the main content
		return res.redirect("main.html");
	} else {
		// password incorrect, redirect back to login page
		// res.sendFile(__dirname + "/public/login.html");
		return res.json({ incorrect: true });
	}
});

app.post("/signup", async (req, res) => {
	const user = req.session?.user;
	if (req.body === null || req.body === undefined || req.body.username.length < 4) {
		return res.json(null);
	}
	const userPass = await userPassCollection.findOne({ username: req.body.username });
	let body = { accountCreated: false }
	if (userPass === null) {
		await userPassCollection.insertOne({ username: req.body.username, password: req.body.password })
		body.accountCreated = true;
		await addSampleTimes(user);
		await resetAverages(user);

	}

	res.json(body);
});

// add some middleware that always sends unauthenicaetd users to the login page
app.use(function (req, res, next) {
	if (req.session.login === true) {
		next();
	} else {
		res.sendFile(__dirname + "/public/login.html");
	}
});

app.get('/', function (req, res) {
	res.sendFile(__dirname + "/public/login.html");
});



/**
 * Remove all times and add 3 sample reaction times
 */
app.delete("/reset", async (req, res) => {
	const user = req.session?.user
	timesCollection.deleteMany({ user })
	// timesCollection = await client.db("a3-RichardNewman-Data").createCollection("times");
	await addSampleTimes(user);
	await resetAverages(user);
	const docs = await getAllDocs(user);
	res.json(docs);
});

// Check collections for proper functionality
app.use((req, res, next) => {
	if (timesCollection !== null || averagesCollection !== null) {
		next();
	} else {
		res.status(503).send();
	}
});

// assumes req.body takes form { _id:5d91fb30f3f81b282d7be0dd } etc.
app.delete("/remove", async (req, res) => {
	const user = req.session?.user;
	let result;
	if (req.body.type === "single") {
		result = await timesCollection.findOneAndDelete({
			_id: new ObjectId(req.body._id),
		});
	} else {
		result = await timesCollection.deleteMany({
			name: req.body.name,
			user
		});
	}
	await resetAverages(user);
	const docs = await getAllDocs(user);
	res.json(docs);
});

app.get("/user", async (req, res) => {
	const user = await req.session?.user;
	const docs = await getAllDocs(user);
	res.json({ user, docs });
})

app.put("/edit", async (req, res) => {
	const user = await req.session?.user;
	const result = await timesCollection.updateOne({ _id: new ObjectId(req.body._id) }, { $set: { ms: req.body.ms } });
	await resetAverages(user);
	const docs = await getAllDocs(user);
	res.json(docs);
});

app.post("/submit", async (req, res) => {
	const user = req.session?.user
	req.body.user = user;
	const result1 = await timesCollection.insertOne(req.body);
	if (result1 === null || result1.acknowledged === false) {
		res.json(result1);
		return;
	}

	const result2 = await updateOneAverage(req.body, user);
	if (result2 === null || result2.acknowledged === false) {
		res.json(result2);
		return;
	}

	const docs = await getAllDocs(user);
	res.json(docs);
});

app.post("/logout", async (req, res) => {

	const user = req?.session?.user;
	req.session = null;
	return res.redirect("login.html");
});

app.listen(process.env.PORT || 3000);
