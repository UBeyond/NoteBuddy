const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
server.listen(80);
const path = require("path");


var notebookId;
var name;
var userId;
var socketId;

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname + "/public/pages/home.html"));
});

app.get("/notebook", (req, res) => {
	res.sendFile(path.join(__dirname + "/public/pages/notebook.html"));
});

io.on("connection", function(socket) {
    var room = socket.handshake["query"]["notebookId"];
    socket.join(room);
    socket.on("newConnection", function(data) {
		notebookId = data.notebookId;
		name = data.name;
        userId = data.userId;
        socket.broadcast.to(room).emit("showConnection", data);
		console.log("new connection");
	});
	socket.on("sendMessage", function(data) {
		socket.broadcast.to(room).emit("showMessage", data);
	});
	// Let everybody know cursor location of everybody online.
	socket.on("sendCursorQueue", function(data) {
		socket.broadcast.to(room).emit("processCursorQueue", data);
		//console.log(data);
	});
	// Somebody is drawing, let everybody know except the person who is drawing.
    socket.on("sendDrawingQueue", function(data) {
		socket.broadcast.to(room).emit("processDrawingQueue", data);
		//console.log(data);
	});
	socket.on("disconnect", function() {
		socket.broadcast.to(room).emit("deleteCursor", {userId: userId});
	});
});