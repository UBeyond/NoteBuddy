const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
server.listen(80);
const path = require("path");

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname + "/public/pages/home.html"));
});

app.get("/notebook", (req, res) => {
	res.sendFile(path.join(__dirname + "/public/pages/notebook.html"));
})

var notebookId;
var name;
var userId;
var socketId;

function onConnection(socket) {
	socket.on("newConnection", function(data) {
		notebookId = data.notebookId;
		name = data.name;
		userId = data.userId;
		socketId = socket.id;
		socket.join(notebookId);
		io.to(notebookId).emit("showConnection", data);
		console.log("new connection");
	});
	socket.on("sendMessage", function(data) {
		socket.broadcast.emit("showMessage", data);
	});
	// Let everybody know cursor location of everybody online.
	socket.on("sendCursorQueue", function(data) {
		socket.broadcast.emit("processCursorQueue", data);
		//console.log(data);
	});
	// Somebody is drawing, let everybody know except the person who is drawing.
    socket.on("sendDrawingQueue", function(data) {
		socket.broadcast.emit("processDrawingQueue", data);
		//console.log(data);
	});
	socket.on("disconnect", function() {
		socket.broadcast.emit("deleteCursor", {userId: userId});
	});
}

io.on("connection", onConnection);