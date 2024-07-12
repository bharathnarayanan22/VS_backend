const express = require("express");
const faceapi = require("face-api.js");
const mongoose = require("mongoose");
const { Canvas, Image } = require("canvas");
const canvas = require("canvas");
const fileUpload = require("express-fileupload");
faceapi.env.monkeyPatch({ Canvas, Image });
const cors = require("cors")
const bodyParser = require("body-parser");


const app = express();
app.use(cors())
// Example middleware for CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Replace '*' with specific origins as needed
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({limit: '50mb',extended : true}));
// app.use(
//   cors({
//     origin: 'https://vs-frontend-seven.vercel.app', // Allow requests from this origin
//     // methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow these HTTP methods
//     // allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers
//   })
// );


app.use(fileUpload({ useTempFiles: true }));

// MongoDB connection
mongoose.connect('mongodb+srv://Bharath_Narayanan:bharath22@cluster0.16bef1g.mongodb.net/VotingSystem', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
    app.listen(process.env.PORT || 5000);
    console.log("DB connected and server is running.");
  })
  

// Load face detection models
async function loadModels() {
  await faceapi.nets.faceRecognitionNet.loadFromDisk(__dirname + "/models");
  await faceapi.nets.faceLandmark68Net.loadFromDisk(__dirname + "/models");
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(__dirname + "/models");
}
loadModels();

// Define MongoDB schema and model
const faceSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    unique: true,
  },
  descriptions: {
    type: Array,
    required: true,
  },
  hasVoted: {
    type: Boolean,
    default: false,
  },
});


const FaceModel = mongoose.model("Face", faceSchema);

// Upload labeled image

async function uploadLabeledImages(images, label){
  try {
    const descriptions = [];
    for (let i = 0; i < images.length; i++) {
      const img = await canvas.loadImage(images[i]);
      const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      descriptions.push(detections.descriptor);
    }

    const createFace = new FaceModel({
      label: label,
      descriptions: descriptions,
    });
    await createFace.save();
    return true;
  } catch (error) {
    console.log(error);
    return error;
  }
}


app.post("/post-face", async (req, res) => {
  const File1 = req.files.File1.tempFilePath;
  const File2 = req.files.File2.tempFilePath;
  const File3 = req.files.File3.tempFilePath;
  const label = req.body.label;

  let result = await uploadLabeledImages([File1, File2, File3], label);

  if (result === 'Voter already enrolled') {
    return res.status(409).json({ message: "Voter already enrolled" });
  } else if (result) {
    return res.json({ message: "Face data stored successfully" });
  } else {
    return res.status(500).json({ message: "Something went wrong, please try again." });
  }
});
// Handle POST request to upload faces(changed 10/06)
// app.post("/post-face", async (req, res) => {
//   const File1 = req.files.File1.tempFilePath;
//   const File2 = req.files.File2.tempFilePath;
//   const File3 = req.files.File3.tempFilePath;
//   const label = req.body.label;

//   let result = await uploadLabeledImages([File1, File2, File3], label);

//   if (result === 'Voter already enrolled') {
//     res.status(409).json({ message: "Voter already enrolled" });
//   } else if (result) {
//     res.json({ message: "Face data stored successfully" });
//   } else {
//     res.json({ message: "Something went wrong, please try again." });
//   }
// });

// app.post("/post-face", async (req, res) => {
//   const File1 = req.files.File1.tempFilePath;
//   const File2 = req.files.File2.tempFilePath;
//   const File3 = req.files.File3.tempFilePath;
//   const label = req.body.label;
  
//   let result = await uploadLabeledImages([File1, File2, File3], label);
  
//   if (result) {
//     res.json({ message: "Face data stored successfully" });
//   } else {
//     res.json({ message: "Something went wrong, please try again." });
//   }
// });

// Retrieve face descriptors from database
async function getDescriptorsFromDB(image) {
  let faces = await FaceModel.find();
  
  for (i = 0; i < faces.length; i++) {
    for (j = 0; j < faces[i].descriptions.length; j++) {
      faces[i].descriptions[j] = new Float32Array(Object.values(faces[i].descriptions[j]));
    }
    faces[i] = new faceapi.LabeledFaceDescriptors(faces[i].label, faces[i].descriptions);
  }

  const faceMatcher = new faceapi.FaceMatcher(faces, 0.6);
  const img = await canvas.loadImage(image);
  let temp = faceapi.createCanvasFromMedia(img);
  const displaySize = { width: img.width, height: img.height };
  faceapi.matchDimensions(temp, displaySize);

  const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
  const resizedDetections = faceapi.resizeResults(detections, displaySize);
  const results = resizedDetections.map((d) => faceMatcher.findBestMatch(d.descriptor));
  return results;
}

// Handle POST request to check faces
// app.post("/check-face", async (req, res) => {
//   const File1 = req.files.File1.tempFilePath;
//   let result = await getDescriptorsFromDB(File1);

//   if (result.hasVoted) {
//     res.json({ hasVoted: true });
//   } else if (result.validFace) {
//     res.json({ hasVoted: false, faceId: result.faceId });
//   } else {
//     res.json({ hasVoted: false });
//   }
// });

// app.post("/check-face", async (req, res) => {
//   const File1 = req.files.File1.tempFilePath;
//   let results = await getDescriptorsFromDB(File1);

//   if (!results || results.length === 0) {
//     return res.json({ hasVoted: false, validFace: false });
//   }

//   const bestMatch = results[0];
//   const voter = await FaceModel.findOne({ label: bestMatch.label });

//   if (!voter) {
//     return res.json({ hasVoted: false, validFace: false });
//   }

//   res.json({ hasVoted: voter.hasVoted, validFace: true, faceId: voter._id });
// });

app.post("/check-face", async (req, res) => {
  // res.setHeader('Access-Control-Allow-Origin', '*');
  // res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  // res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');
  const File1 = req.files.File1.tempFilePath;
  let results = await getDescriptorsFromDB(File1);

  if (!results || results.length === 0) {
    return res.json({ hasVoted: false, validFace: false });
  }

  const bestMatch = results[0];
  const voter = await FaceModel.findOne({ label: bestMatch.label });

  if (!voter) {
    return res.json({ hasVoted: false, validFace: false });
  }


  res.json({ hasVoted: voter.hasVoted, validFace: true, faceId: voter._id });

    // Update the hasVoted status to true
    voter.hasVoted = true;
    await voter.save();
});




// Define MongoDB schema for party enrollment
const partySchema = new mongoose.Schema({
  partyName: {
    type: String,
    required: true,
    unique: true, // Ensure uniqueness
  },
  partyLeader: {
    type: String,
    required: true,
    unique: true, // Ensure uniqueness
  },
  partySymbol: {
    type: String,
    required: true,
  },
  VoteCount: { 
    type: Number, 
    default: 0 
  },
});

// Define compound index
partySchema.index({ partyName: 1, partyLeader: 1 }, { unique: true });

const Party = mongoose.model('Party', partySchema);

module.exports = Party;

// Create a model for party enrollment
const PartyModel = mongoose.model("Party", partySchema);


// POST endpoint to enroll a new party
app.post("/enroll-party", async (req, res) => {
  try {
    const { partyName, partyLeader, partySymbol } = req.body;

    // Check if the party name, leader, or symbol already exists (case-insensitive)
    const existingParty = await PartyModel.findOne({
      $or: [
        { partyName: { $regex: new RegExp(`^${partyName}$`, 'i') } },
        { partyLeader: { $regex: new RegExp(`^${partyLeader}$`, 'i') } },
        { partySymbol: { $regex: new RegExp(`^${partySymbol}$`, 'i') } },
      ],
    });

    if (existingParty) {
      return res.status(409).json({ message: 'Party already enrolled.' });
    }

    // Create a new party enrollment document
    const newParty = new PartyModel({
      partyName,
      partyLeader,
      partySymbol,
    });

    // Save the new party enrollment document to the database
    await newParty.save();

    res.json({ message: "Party enrolled successfully" });
  } catch (error) {
    console.error("Error enrolling party:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET endpoint to fetch all parties
app.get('/parties', async (req, res) => {
  try {
    const parties = await PartyModel.find();
    res.json({ parties });
  } catch (error) {
    console.error('Error fetching parties:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT endpoint to update party details by ID
app.put('/parties/:id', async (req, res) => {
  const { id } = req.params;
  const { partyName, partyLeader, partySymbol } = req.body;

  try {
    // Check if the new party name, leader, or symbol already exists (case-insensitive)
    const existingParty = await PartyModel.findOne({
      $or: [
        { partyName: { $regex: new RegExp(`^${partyName}$`, 'i') } },
        { partyLeader: { $regex: new RegExp(`^${partyLeader}$`, 'i') } },
        { partySymbol: { $regex: new RegExp(`^${partySymbol}$`, 'i') } },
      ],
      _id: { $ne: id } // Exclude the current party being updated
    });

    if (existingParty) {
      return res.status(409).json({ message: 'Party already enrolled.' });
    }

    // Find the party by ID and update its details
    const updatedParty = await PartyModel.findByIdAndUpdate(id, {
      partyName,
      partyLeader,
      partySymbol
    }, { new: true }); // Set { new: true } to return the updated party document

    if (updatedParty) {
      res.status(200).json({ message: "Party updated successfully", party: updatedParty });
    } else {
      res.status(404).json({ message: "Party not found" });
    }
  } catch (error) {
    console.error("Error updating party:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE endpoint to delete a party by ID
app.delete("/parties/:partyId", async (req, res) => {
  const partyId = req.params.partyId;
  try {
    // Find the party by ID and delete it from the database
    await PartyModel.findByIdAndDelete(partyId);
    res.status(200).json({ message: "Party deleted successfully" });
  } catch (error) {
    console.error("Error deleting party:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.post('/voters/vote/:partyId', async (req, res) => {
  const { partyId } = req.params;
  try {
    const party = await PartyModel.findById(partyId);
    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }
    // Increment the vote count for the party
    party.VoteCount += 1;
    // Save the updated party
    await party.save();
    res.json(party); // Return the updated party
  } catch (error) {
    console.error('Error updating vote count:', error);
    res.status(500).json({ message: 'Error updating vote count' });
  }
});

app.get('/voters/has-voted/:voterId', async (req, res) => {
  const { voterId } = req.params;

  try {
    // Find the voter by ID
    const voter = await FaceModel.findById(voterId);

    if (!voter) {
      return res.status(404).json({ message: 'Voter not found' });
    }

    // Return the voter's voting status
    res.json({ hasVoted: voter.hasVoted });
  } catch (error) {
    console.error('Error checking voting status:', error);
    res.status(500).json({ message: 'Error checking voting status' });
  }
});

app.get('/parties/ViewResults', async (req, res) => {
  try {
    const parties = await PartyModel.find({}).sort({ VoteCount: -1 });
    res.json({ parties });
  } catch (error) {
    console.error('Error fetching parties:', error);
    res.status(500).json({ message: 'Error fetching parties' });
  }
});

// Route to fetch voters
app.get('/voters', async (req, res) => {
  try {
    const voters = await FaceModel.find();
    res.json({ voters });
  } catch (error) {
    console.error('Error fetching voters:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route to delete a voter
app.delete("/voters/:voterId", async (req, res) => {
  const voterId = req.params.voterId;
  try {
    // Find the voter by ID and delete it from the database
    await FaceModel.findByIdAndDelete(voterId);
    res.status(200).json({ message: "Voter deleted successfully" });
  } catch (error) {
    console.error("Error deleting voter:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = app;