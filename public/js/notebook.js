var app = new Vue({
    el: "#app",
    created() {
        // Can't access `this` here unless I re-define it. Why?
        let self = this;
        // Generate User ID
        self.userId = self.generateUserId();
        if (location.hash === "") {
            // Generate Notebook ID
            self.notebookId = self.generateNotebookId();
            location.hash = `#${self.notebookId}`;
        } else {
            self.notebookId = location.hash.substr(1);
        }
    },
    mounted() {
        // Can't access `this` here unless I re-define it. Why?
        let self = this;
        let socket = io.connect("https://notebuddysocial.herokuapp.com/", {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax : 5000,
            reconnectionAttempts: 99999,
            pingInterval: 500
        });
        socket.on("showConnection", function(data) {
            if (data.name !== self.name) {
                self.buddyMessage(`${data.name} just joined this notebook. You should say hi to them!`);
            } else {
                if (self.tutorialWelcome === false) {
                    self.buddyMessage(`Welcome to NoteBuddy, ${data.name}! My name is Buddy and I'm here to keep you company and help you. Since you're new here I'm going to be giving you some tips as you navigate the site. You can click on any of these messages to make them disappear. Your notebook # is ${self.notebookId}. If you share that number or the link to this page with people they can collaborate on this notebook with you.`);
                    self.tutorialWelcome = true;
                }
            }
        });
        socket.on("showMessage", function(data) {
            let chatLog = document.querySelector("#chatLog");
            chatLog.insertAdjacentHTML("beforeend", `<div class="chat from">${data.message}</div><div class="name from">${data.name}</div>`);
        });
        socket.on("processDrawingQueue", function(data) {
            self.processDrawingQueue(data);
            self.loadCanvasScreenshot();
        });
        socket.on("processCursorQueue", function(data) {
            self.processCursorQueue(data);
        });
        socket.on("deleteCursor", function(data) {
            self.deleteCursor(data.userId);
        });
        var name = prompt("What is your name?", "Guest");
        if (name == null || name == "") {
            self.name = "Guest";
        } else {
            self.name = name;
        }
        // Let Socket Know About Connection
        self.newConnection(self.notebookId, self.name, self.userId);
        // Load Canvas
        let ctx = self.loadCanvas();
        // Set Canvas Size
        ctx.canvas.width = 2000;
        ctx.canvas.height = 2000;
        function downListener(event) {
            var rect = event.target.getBoundingClientRect();
            var x = event.clientX - rect.left;
            var y = event.clientY - rect.top;
            if (event.target.id !== "canvas") {
                if (event.target.id === "previewImg") {
                    //alert(`x: ${x * 20}, y: ${y * 20}`);
                    window.scrollTo(x * 15, y * 15);
                    if (self.tutorialPreview === false) {
                        self.buddyMessage("This little box will show a preview of this entire notebook. If you click somewhere inside this little box you'll be teleported there instantly.");
                        self.tutorialPreview = true;
                    }
                } else {
                    // ..
                }
                return;
            }
            self.down = true;
            self.moved = false;
            //alert(`x: ${x}, y: ${y}`);
            // Add To Cursor Queue
            self.cursorQueue.push({
                x: x, 
                y: y, 
                color: self.color, 
                brush: self.brush,
                userId: self.userId,
                name: self.name
            });
            //self.placeCursor(self.userId, self.name, x, y, self.color);
            // Add To Drawing Queue
            self.drawingQueue.push({
                x: x, 
                y: y, 
                color: self.color, 
                brush: self.brush,
                userId: self.userId,
                name: self.name
            });
            self.draw(x, y, self.color, self.brush);
        }
        document.addEventListener("mousedown", downListener);
        function upListener() {
            self.down = false;
        }
        document.addEventListener("mouseup", upListener);
        function leaveListener() {
            self.down = false;
        }
        document.addEventListener("mouseleave", leaveListener);
        document.addEventListener("mousemove", function(event) {
            self.moved = true;
            if (event.target.id !== "canvas" && self.down) {
                return;
            }
            var rect = event.target.getBoundingClientRect();
            var x = event.clientX - rect.left;
            var y = event.clientY - rect.top;
            // Add To Cursor Queue
            self.cursorQueue.push({
                x: x, 
                y: y, 
                color: self.color, 
                brush: self.brush,
                userId: self.userId,
                name: self.name
            });
            //self.placeCursor(self.userId, self.name, x, y, self.color);
            if (self.down && self.moved) {
                // Add To Drawing Queue
                self.drawingQueue.push({
                    x: x, 
                    y: y, 
                    color: self.color, 
                    brush: self.brush,
                    userId: self.userId,
                    name: self.name
                });
                self.draw(x, y, self.color, self.brush);
            }
        });
        document.addEventListener("submit", function(event) {
            if (event.target.id === "sendMessageForm") {
                let message = document.querySelector("#sendMessageForm textarea");
                if (message.value === null || message.value === "") {
                    self.buddyMessage("You need to enter a message to send a message silly.");
                } else {
                    socket.emit("sendMessage", {
                        name: self.name,
                        userId: self.userId,
                        message: message.value
                    });
                    let chatLog = document.querySelector("#chatLog");
                    chatLog.insertAdjacentHTML("beforeend", `<div class="chat sent">${message.value}</div><div class="name sent">${self.name}</div>`);
                    // Clear Textarea
                    message.value = "";
                }
            } else {
                // ...
            }
            event.preventDefault();
        });
        // Send Cursor Queue
        setInterval(self.sendCursorQueue, 1000);
        // Send Drawing Queue
        setInterval(self.sendDrawingQueue, 1000);
	},
	data: {
        "notebookId": null,
        "name": "Guest",
        "color": "black",
        "brush": "small",
        "down": false,
        "moved": false,
        "userId": false,
        "drawingQueue": [],
        "cursorQueue": [],
        "tutorialWelcome": false,
        "tutorialPreview": false,
        "tutorialColorSelector": false,
        "tutorialUpdateColor": false,
        "tutorialBrushSelector": false,
        "tutorialUpdateBrush": false,
        "tutorialEraser": false,
        "tutorialOpenChat": false
	},
	methods: {
        loadCanvas: function() {
            let canvas = document.querySelector("#canvas");
            let ctx = canvas.getContext("2d");
            return ctx;
        },
        loadCanvasScreenshot: function() {
            // Load Canvas
            let ctx = this.loadCanvas();
            let preview = canvas.toDataURL("image/png");
            let previewSelector = document.querySelector("#app #preview");
            previewSelector.innerHTML = `<img src="${preview}" id="previewImg">`;
        },
        newConnection: function(notebookId, name, userId) {
            let socket = io.connect("https://notebuddysocial.herokuapp.com/", {
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax : 5000,
                reconnectionAttempts: 99999,
                pingInterval: 500
            });
            socket.emit("newConnection", {
                notebookId: notebookId,
                name: name,
                userId: userId
            });
        },
        createCursor: function(userId, name, x, y, color) {
            // Load Canvas
            let ctx = this.loadCanvas();
            // Create Cursor Element
            let cursor = document.createElement(`div`);
            // Add Classes To Cursor
            cursor.classList.add("cursor");
            cursor.classList.add(`user${userId}`);
            // Add Styles To Cursor
            cursor.style.cssText = `position: absolute; left: ${x}px; top: ${y}px;`;
            // Add Inner HTML To Cursor
            cursor.innerHTML = `<div class="indicator" style="border: 4px solid ${color};"></div><div class="name">${name}</div>`;
            // Append Cursor To Parent
            canvas.parentNode.appendChild(cursor);
            //console.log(`created at x: ${x}, y: ${y}`)
        },
        placeCursor: function(userId, name, x, y, color) {
            let cursor = document.querySelector(`#app .cursor.user${userId}`);
            if (cursor !== null) {
                // Load Canvas
                let ctx = this.loadCanvas();
                cursor.style.cssText = `position: absolute; left: ${x}px; top: ${y}px;`;
                cursor.innerHTML = `<div class="indicator" style="border: 4px solid ${color};"></div><div class="name">${name}</div>`;
                // Append To Canvas
                canvas.parentNode.appendChild(cursor);
            } else {
                this.createCursor(userId, name, x, y, color);
            }
            //console.log(`placed at x: ${x}, y: ${y}`)
        },
        sendCursorQueue: function() {
            if (this.cursorQueue.length > 0) {
                let socket = io.connect("https://notebuddysocial.herokuapp.com/", {
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax : 5000,
                    reconnectionAttempts: 99999,
                    pingInterval: 500
                });
                socket.emit("sendCursorQueue", this.cursorQueue);
                // Reset Drawing Queue
                this.cursorQueue = [];
            }
        },
        processCursorQueue: function(cursorData) {
            // Loop Through Cursor Data
            for (const iterated of cursorData) { 
                if (iterated.userId !== this.userId) {
                    this.placeCursor(iterated.userId, iterated.name, iterated.x, iterated.y, iterated.color);
                }
            }
        },
        deleteCursor: function(userId) {
            let cursor = document.querySelector(`#app .cursor.user${userId}`);
            // Cursor Exists
            if (cursor !== null) {
                cursor.parentNode.removeChild(cursor);
            }
        },
        draw: function(x, y, color, brush) {
            // Load Canvas
            let ctx = this.loadCanvas();
            //Align to grid
            //x = this.closestInteger(x, 20);
            //y = this.closestInteger(y, 20);
            ctx.fillStyle = color;
            if (color === "rainbow") {
                if (brush === "small") {
                    var brushSize = 5;
                } else if (brush === "medium") {
                    var brushSize = 10;
                } else {
                    var brushSize = 15;
                }
                for (var angle=0; angle<=360; angle+=1) {
                    var startAngle = (angle-1)*Math.PI/180;
                    var endAngle = angle * Math.PI/180;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.arc(x, y, brushSize, startAngle, endAngle, false);
                    ctx.closePath();
                    ctx.fillStyle = 'hsl('+angle+', 100%, 50%)';
                    ctx.fill();
                }
            } else if (brush === "eraser") {
                ctx.clearRect(x, y, 20, 20);
                //ctx.arc(x, y, 10, 0, 2 * Math.PI);
            } else if (brush === "small") {
                //Pixel Art
                //ctx.fillRect(x, y, 5, 5);
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fill();
            } else if (brush === "medium") {
                //Pixel Art
                //ctx.fillRect(x, y, 10, 10);
                ctx.beginPath();
                ctx.arc(x, y, 10, 0, 2 * Math.PI);
                ctx.fill();
            } else if (brush === "large") {
                //Pixel Art
                //ctx.fillRect(x, y, 20, 20);
                ctx.beginPath();
                ctx.arc(x, y, 15, 0, 2 * Math.PI);
                ctx.fill();
            } else if (brush === "text") {
                ctx.font = "30px Roboto";
                ctx.fillText("Hello, World!", x, y);
                this.down = false;
                this.brush = "small";
            } else if (brush === "image") {
                var img = document.createElement("img");
                img.src = "https://upload.wikimedia.org/wikipedia/en/5/5f/Original_Doge_meme.jpg";
                img.style.cssText = "position:absolute; left:" + x + "px; top:" + y + "px;";
                canvas.parentNode.appendChild(img);
                // Set Brush Back To Default
                this.brush = "small";
            } else if (brush === "video") {
                var f = document.createElement("iframe");
                f.allow = "autoplay; encrypted-media";
                f.frameBorder = "0";
                f.setAttribute("allowfullscreen", "")
                f.style.cssText = "position:absolute; left:" + x + "px; top:" + y + "px; width:560px; height:315px;";
                f.src = "https://www.youtube.com/embed/dQw4w9WgXcQ";
                canvas.parentNode.appendChild(f);
                this.down = false;
                this.brush = "small";
            } else {
                //Pixel Art
                //ctx.fillRect(x, y, 5, 5);
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        },
        sendDrawingQueue: function() {
            if (this.drawingQueue.length > 0) {
                let socket = io.connect("https://notebuddysocial.herokuapp.com/", {
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax : 5000,
                    reconnectionAttempts: 99999,
                    pingInterval: 500
                });
                socket.emit("sendDrawingQueue", this.drawingQueue);
                // Reset Drawing Queue
                this.drawingQueue = [];
            }
        },
        processDrawingQueue: function(drawingData) {
            for (const iterated of drawingData) { 
                this.draw(iterated.x, iterated.y, iterated.color, iterated.brush);
            }
        },
        showColorSelector: function() {
            let element = document.querySelector("#colorSelectorPopup");
            if (element.style.display === "none") {
                element.style.display = "block";
                if (this.tutorialColorSelector === false) {
                    this.buddyMessage("This is the color selector which allows you to change the color of your brush. This is a great way to make your notes stand out.");
                    this.tutorialColorSelector = true;
                }
            } else {
                element.style.display = "none";
            }
        },
        showBrushSelector: function() {
            let element = document.querySelector("#brushSelectorPopup");
            if (element.style.display === "none") {
                element.style.display = "block";
                if (this.tutorialBrushSelector === false) {
                    this.buddyMessage("This is the brush selector which allows you to change the size of your brush. There is 3 different brush sizes to choose from.");
                    this.tutorialBrushSelector = true;
                }
            } else {
                element.style.display = "none";
            }
        },
        showTextSelector: function() {
            let element = document.querySelector("#textSelectorPopup");
            if (element.style.display === "none") {
                element.style.display = "block";
            } else {
                element.style.display = "none";
            }
        },
        toggleChat: function() {
            let element = document.querySelector("#chatWrapper");
            if (element.style.display === "none") {
                element.style.display = "block";
                if (this.tutorialOpenChat === false) {
                    this.buddyMessage("You just opened the chat for this notebook. Feel free to chat with others but please be friendly.");
                    this.tutorialOpenChat = true;
                }
            } else {
                element.style.display = "none";
            }
        },
        updateColor: function(color) {
            this.color = color;
            if (this.tutorialUpdateColor === false) {
                this.buddyMessage(`See! You're getting the hang of things! Now when you draw it will be ${color}.`);
                this.tutorialUpdateColor = true;
            }
            this.showColorSelector();
            if (this.brush === "eraser") {
                this.brush = "small";
            }
        },
        updateBrush: function(brush) {
            this.brush = brush;
            if (brush === "eraser") {
                if (this.tutorialEraser === false) {
                    this.buddyMessage(`You've stumbled upon your eraser! Make sure you use this tool wisely.`);
                    this.tutorialEraser = true;
                }
            } else {
                if (this.tutorialUpdateBrush === false) {
                    this.buddyMessage(`See! You're getting the hang of things! Now when you draw it will be ${brush}.`);
                    this.tutorialUpdateBrush = true;
                }
                this.showBrushSelector();
            }
        },
        closestInteger: function(a, b) {
            let c1 = a - (a % b);
            let c2 = (a + b) - (a % b);
            if (a - c1 > c2 - a) {
                return c2;
            } else {
                return c1;
            }
        },
        generateNotebookId: function() {
            return Math.floor(Math.random() * 999999999999) + 100000000000;
        },
        generateUserId: function() {
            const validChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            let array = new Uint8Array(40);
            window.crypto.getRandomValues(array);
            array = array.map(x => validChars.charCodeAt(x % validChars.length));
            return randomState = String.fromCharCode.apply(null, array);
        },
        buddyMessage: function(message) {
            let buddyMsgDynamic = document.querySelector("#buddyMsgDynamic");
            buddyMsgDynamic.innerHTML = `<div id="buddyMsg">${message}</div>`;
            //setTimeout(this.deleteBuddyMessage, 10000);
        },
        deleteBuddyMessage: function() {
            let buddyMsgDynamic = document.querySelector("#buddyMsgDynamic");
            buddyMsgDynamic.innerHTML = "";
        }
	}
});
               