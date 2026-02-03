const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let boards = new Set();
let turnOrder = [];
let currentTurn = 0;
let circleValues = [];
let horseSteps = {};

function shuffle(a){ return a.sort(()=>Math.random()-0.5); }
function newCircles(){ circleValues = shuffle([1,2,3,4,5,6]); }

io.on("connection",(socket)=>{

    // 👉 Δήλωση αν είναι board
    socket.on("i_am_board",()=>{
        boards.add(socket.id);
    });

    // 👉 Δήλωση αν είναι player
    socket.on("choose_color",(color)=>{
        if(boards.has(socket.id)) return;

        const taken = Object.values(players).find(p=>p.color===color);
        if(!taken){
            players[socket.id]={color,ready:false};
            socket.emit("color_ok");
            io.emit("update_players",players);
        }else socket.emit("color_taken");
    });

    socket.on("player_ready",()=>{
        if(players[socket.id]){
            players[socket.id].ready=true;
            io.emit("update_players",players);
        }
    });

    // 👉 START μόνο από board
    socket.on("start_game",()=>{
        if(!boards.has(socket.id)) return;

        const readyPlayers = Object.values(players).filter(p=>p.ready);
        if(readyPlayers.length < 2) return;

        turnOrder = shuffle(readyPlayers.map(p=>p.color));
        turnOrder.forEach(c=>horseSteps[c]=0);

        io.emit("reveal_order",turnOrder);

        setTimeout(()=>{
            newCircles();
            io.emit("start_turn",turnOrder[currentTurn]);
        },4000);
    });

    socket.on("pick_circle",(index)=>{
        if(!players[socket.id]) return;

        const player = players[socket.id];
        const steps = circleValues[index];

        socket.emit("reveal_number",steps);
        horseSteps[player.color]+=steps*13;

        io.emit("move_horse",{color:player.color,steps});
    });

    socket.on("animation_done",(color)=>{
        if(horseSteps[color] >= 900){
            io.emit("winner",color);
            setTimeout(()=>{
                io.emit("reset_board");
                players={};
                turnOrder=[];
                currentTurn=0;
                horseSteps={};
            },4000);
            return;
        }

        currentTurn=(currentTurn+1)%turnOrder.length;
        newCircles();
        io.emit("start_turn",turnOrder[currentTurn]);
    });

    socket.on("disconnect",()=>{
        delete players[socket.id];
        boards.delete(socket.id);
        io.emit("update_players",players);
    });

});

server.listen(process.env.PORT || 3000);
