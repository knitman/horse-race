const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let turnOrder = [];
let currentTurn = 0;
let circleValues = [];

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function newCircleValues(){
    circleValues = shuffle([1,2,3,4,5,6]);
}

function checkAllReady() {
    const list = Object.values(players);
    const allReady = list.length > 0 && list.every(p => p.ready);

    if (allReady) {
        turnOrder = shuffle(list.map(p => p.color));
        io.emit("reveal_order", turnOrder);

        setTimeout(()=>{
            newCircleValues();
            io.emit("start_turns", turnOrder[currentTurn]);
        },4000);
    }
}

io.on("connection", (socket) => {

    socket.on("choose_color", (color) => {
        const taken = Object.values(players).find(p => p.color === color);
        if (!taken) {
            players[socket.id] = { color, ready: false };
            socket.emit("color_ok");
            io.emit("update_players", players);
        } else {
            socket.emit("color_taken");
        }
    });

    socket.on("player_ready", () => {
        if (players[socket.id]) {
            players[socket.id].ready = true;
            io.emit("update_players", players);
            checkAllReady();
        }
    });

    socket.on("pick_circle", (index) => {
        const player = players[socket.id];
        if (!player) return;

        const value = circleValues[index];

        socket.emit("reveal_number", value);
        io.emit("move_horse", { color: player.color, steps: value });

        currentTurn = (currentTurn + 1) % turnOrder.length;
        newCircleValues();

        setTimeout(()=>{
            io.emit("start_turns", turnOrder[currentTurn]);
        },1000);
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        io.emit("update_players", players);
    });
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});
