const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");

const cors = require("cors");
var serviceAccount = require("./firebase_key.json"); // The FireBase credentials as given by Google on the FireBase console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://quizapps-5cb0e.firebaseio.com",
});

const app = express();
app.use(cors({ origin: true }));
const db = admin.firestore();
const api_base = "/api";
app.use(setAPIParametersMiddleWare);

//Please make sure that this middleware function is the firstr in the list of all functions,
//Middlewares execute in the order of definition
//This middleware splits the URL into its parts and extracts the DBRef to either a collection or a document accordingly.
function setAPIParametersMiddleWare(req, res, next) {
  var url_array = req.url.split("/");
  console.log("IN MIDDKE WARE");
  console.log(url_array);
  var dbPath = db;
  var isCollection = true;
  for (var i = 2; i < url_array.length; i++) {
    url_part = url_array[i];
    if (url_part !== "") {
      i%2===0?isCollection=true:isCollection=false;
      dbPath=isCollection?dbPath.collection(url_part):dbPath.doc(url_part);
    }
  }
  res.locals.dbPath = dbPath;
  res.locals.isCollection = isCollection;
  next();
}//end of middleware setAPIParametersMiddleware

//The GET function 
app.get(api_base + "/*", async(req, res) => {
  const dbPath = res.locals.dbPath;
  const isCollection = res.locals.isCollection;
  var response = {};
  response.id=dbPath.id;
  if(isCollection){
    if(dbPath.parent){
    response.parent=dbPath.parent.path;
    }
    response.type="collection";
    response.path=dbPath.path;
    response.collectionName=dbPath.id;
    //GET GET THE LIST OF DOCUMENTS ADDED TO THE COLLECTION
    await dbPath.get().then(querySnapshot => {
      var docsData={};
      for (let doc of querySnapshot.docs) {
        docsData[doc.id]=doc.data();
      }
      response.docs=docsData;
    });
  }else
  {
    
    response.collectionName=dbPath.parent.id;
    response.parent=dbPath.parent.path;
    response.path=dbPath.path;
    //GET GET THE DATA ADDED TO THE DOCUMENT
    await dbPath.get().then(documentSnapshot => {
      if (documentSnapshot.exists) {
        var data={};
        data[documentSnapshot.id]=documentSnapshot.data();
        response.doc = data;
      }
    });
    //GET LIST OF COLLECTIONS THAT ARE ADDED IN THE DOCUMENT
    var collData={};
    await dbPath.listCollections().then(collections => {
      const collectionIds = collections.map((col) => col.id);
      if (collectionIds.length > 0) {
        
        collData.ids=collectionIds;
        
      }
    });
    response.collections=collData;
  }
  console.log("Sending response  ");
  console.log(response);
  return res.status(200).send(response);

});

//The POST function
app.post(api_base + "/*", async(req, res) => {
  const dbPath = res.locals.dbPath;
     const data_to_add=req.body;
        console.log(data_to_add);
        if(res.locals.isCollection)
        {
        await dbPath.add(data_to_add).then(docRef=>{
            return res.status(200).send(docRef.id);
        }).catch((err)=>{
          return "err";
        });
      }
      else{
        var subcollection = dbPath.collection(data_to_add.name).doc("blank").set({});
        console.log(" Added collection "+subcollection.path+" with name "+data_to_add.name);
        return res.status(200).send(subcollection.id);
        
      }
});

//The update function
app.put(api_base + "/*", async(req, res) => {
  const dbPath = res.locals.dbPath;
      const data_to_put=req.body;
        if(res.locals.isCollection)
        {
        return res.status(200).send("..");
      }
      else{
       
        await dbPath.update(data_to_put).then(docRef=>{
          return res.status(200).send(docRef.id);
      }).catch((err)=>{
         console.log(err);
         return res.status(500).send(err);
      });
        
      }
});

//The delete function
app.delete(api_base + "/*", async(req, res) => {
  const dbPath = res.locals.dbPath;
    const data_to_add=req.body;
        console.log(data_to_add);
        if(res.locals.isCollection && data_to_add.id){
      await dbPath.doc(data_to_add.id).delete().then(()=>{
        res.status(200).send("deleted");
        }).then((msg)=>{
          res.status(200).send(msg);
         }).catch((err)=>{
          res.status(500).send(err);
        });
        }else
        return res.status(200).send("got deletion request for collection");

});

exports.app = functions.https.onRequest(app);
