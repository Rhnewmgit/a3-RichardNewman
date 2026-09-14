require("dotenv").config();

const express = require("express"),
	{ MongoClient, ServerApiVersion, ObjectId } = require("mongodb"),
	app = express();

const logger = (req, res, next) => {
	console.log("url:", req.url);
	next();
};

app.use(logger);
app.use(express.static("public"));
app.use(express.json());

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

	// route to get all docs
	app.get("/docs", async (req, res) => {
		if (averagesCollection !== null && timesCollection !== null) {
			const docs = await getAllDocs();
			res.json(docs);
		}
	});
}

run();

async function getAllDocs() {
	const times = await timesCollection.find({}).toArray();
	const averages = await averagesCollection.find({}).toArray();
	const docs = { times, averages }
	return docs;
}

async function addSampleTimes() {
	const result = await timesCollection.insertMany([
		{ name: "Sample", ms: 309 },
		{ name: "Sample", ms: 264 },
		{ name: "Sample", ms: 402 }
	]);
	return result;
}

/**
 * Clears the averages collection and rebuilds it based on the times collection
 * @returns the response to the insertion of the recalculated averages
 */
async function resetAverages() {
	await averagesCollection.drop()
	averagesCollection = await client.db("a3-RichardNewman-Data").createCollection("averages");
	const agg = await timesCollection.aggregate([
		{
			$group: {
				_id: "$name",
				n: { $sum: 1 },
				tot: { $sum: "$ms" }
			}
		},
		{
			$set: {
				avg: { $divide: ["$tot", "$n"] },
				name: "$_id"
			}
		},
		{
			$unset: "_id"
		}
	], {});
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
async function updateOneAverage(time) {
	const result = await averagesCollection.findOneAndUpdate(
		{ name: time.name },
		[
			{
				$set: {
					n: { $ifNull: ["$n", 0] },
					tot: { $ifNull: ["$tot", 0] }
				}
			},
			{
				$set: {
					n: { $add: ["$n", 1] },
					tot: { $add: ["$tot", time.ms] }
				}
			},
			{ $set: { avg: { $divide: ["$tot", "$n"] } } },
		],
		{
			upsert: true,
		},
	);
	return result
}



/**
 * Remove all times and add 3 sample reaction times 
 */
app.delete("/reset", async (req, res) => {
	timesCollection.drop()
	timesCollection = await client.db("a3-RichardNewman-Data").createCollection("times");
	await addSampleTimes();
	await resetAverages();
	const docs = await getAllDocs();
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
	let result;
	if (req.body.type === "single") {
		result = await timesCollection.findOneAndDelete({
			_id: new ObjectId(req.body._id),
		});
	} else {
		result = await timesCollection.deleteMany({
			name: req.body.name,
		});
	}
	await resetAverages();
	const docs = await getAllDocs()
	res.json(docs);
});

app.put("/edit", async (req, res) => {
	const result = await timesCollection.updateOne({ _id: new ObjectId(req.body._id) }, { $set: { ms: req.body.ms } });
	await resetAverages();
	const docs = await getAllDocs()
	res.json(docs);
});



app.post("/submit", async (req, res) => {
	const result1 = await timesCollection.insertOne(req.body);
	if (result1 === null || result1.acknowledged === false) {
		res.json(result1);
		return;
	}

	const result2 = await updateOneAverage(req.body)
	if (result2 === null || result2.acknowledged === false) {
		res.json(result2);
		return;
	}

	const docs = await getAllDocs();
	res.json(docs);
});


app.listen(process.env.PORT || 3000);
