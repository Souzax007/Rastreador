const express = require("express");
const https = require("https");
const fs = require("fs");
const { Server } = require("socket.io");
const path = require("path");

const app = express();

// SSL
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, "ssl/key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "ssl/cert.pem"))
};

const server = https.createServer(sslOptions, app);

// SOCKET
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET","POST"]
    }
});

let usuariosOnline = {};
let locationHistory = [];

// ----------------------------
// Servir página
// ----------------------------
app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname,"index.html"));
});

// ----------------------------
// Salvar histórico
// ----------------------------
function saveLocation(loc){

    locationHistory.unshift(loc);

    if(locationHistory.length > 5000){
        locationHistory.pop();
    }

}

// ----------------------------
// Conexão socket
// ----------------------------
io.on("connection",(socket)=>{

    console.log("🎯 Nova conexão:",socket.id);

    // LOGIN DO DISPOSITIVO
    socket.on("login",(user)=>{

        usuariosOnline[socket.id] = {
            ...user,
            socketId: socket.id,
            connectedAt: new Date().toISOString(),
            lastLocation:null
        };

        console.log("👤 Usuário online:",user.id);

        io.emit("usuariosOnline",Object.values(usuariosOnline));

    });

    // ----------------------------
    // TRACK GPS
    // ----------------------------
    socket.on("gps_tracking",(data)=>{

        if(usuariosOnline[socket.id]){

            usuariosOnline[socket.id] = {
                ...usuariosOnline[socket.id],
                ...data,
                lastUpdate:new Date().toISOString()
            };

            if(data.gps){
                usuariosOnline[socket.id].lastLocation = data.gps;
            }

        }

        // salvar histórico
        if(data.gps){

            saveLocation({
                id:data.id,
                lat:data.gps.lat,
                lng:data.gps.lng,
                accuracy:data.gps.accuracy,
                socketId:socket.id,
                timestamp:new Date().toISOString()
            });

        }

        console.log(
            "📍 TRACK:",
            data.id,
            data.gps ? `${data.gps.lat},${data.gps.lng}` : "sem gps"
        );

        io.emit("usuariosOnline",Object.values(usuariosOnline));

    });

    // desconectar
    socket.on("disconnect",()=>{

        console.log("❌ Usuário desconectado:",socket.id);

        delete usuariosOnline[socket.id];

        io.emit("usuariosOnline",Object.values(usuariosOnline));

    });

});

// ----------------------------
// API histórico
// ----------------------------
app.get("/locations",(req,res)=>{

    res.json({
        total:locationHistory.length,
        locations:locationHistory.slice(0,100)
    });

});

app.get("/locations/:userId",(req,res)=>{

    const userLocations = locationHistory.filter(
        loc=>loc.id === req.params.userId
    );

    res.json(userLocations.slice(0,50));

});


// ----------------------------
// Start servidor
// ----------------------------
server.listen(3000,"0.0.0.0",()=>{

    console.log("🚀 Servidor rodando em:");
    console.log("https://localhost:3000");
    console.log("📍 Tracking GPS ativo");

});