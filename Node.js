const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let usuariosOnline = {};
let locationHistory = [];

// ----------------------------
// Servir página
// ----------------------------
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ----------------------------
// Histórico de localização
// ----------------------------
function saveLocation(loc) {

    locationHistory.unshift(loc);

    if (locationHistory.length > 5000) {
        locationHistory.pop();
    }
}

// ----------------------------
// Conexão Socket
// ----------------------------
io.on("connection", (socket) => {

    console.log("🎯 Nova conexão:", socket.id);

    // LOGIN
    socket.on("login", (user) => {

        usuariosOnline[socket.id] = {
            ...user,
            socketId: socket.id,
            connectedAt: new Date().toISOString(),
            lastLocation: null
        };

        console.log("👤 Usuário online:", user.id, user.device);

        io.emit("usuariosOnline", Object.values(usuariosOnline));
    });

    // ----------------------------
    // GPS TRACKING COMPLETO
    // ----------------------------
    socket.on("gps_tracking", (data) => {

        if (usuariosOnline[socket.id]) {

            usuariosOnline[socket.id] = {
                ...usuariosOnline[socket.id],
                ...data,
                lastUpdate: new Date().toISOString()
            };

            if (data.gps) {
                usuariosOnline[socket.id].lastLocation = data.gps;
            }
        }

        // salvar no histórico
        if (data.gps) {

            saveLocation({
                id: data.id,
                lat: data.gps.lat,
                lng: data.gps.lng,
                accuracy: data.gps.accuracy,
                speed: data.gps.speed,
                socketId: socket.id,
                timestamp: new Date().toISOString()
            });

        }

        // log detalhado
        console.log(
            "📍 TRACK:",
            data.id,
            data.gps
                ? `${data.gps.lat},${data.gps.lng}`
                : data.geoIP?.city || "No GPS",
            "| IP:", data.ip || "-",
            "| Device:", data.userAgent?.slice(0, 30)
        );

        io.emit("usuariosOnline", Object.values(usuariosOnline));
    });

    // ----------------------------
    // Atualização de rede
    // ----------------------------
    socket.on("networkUpdate", (network) => {

        if (usuariosOnline[socket.id]) {
            usuariosOnline[socket.id].network = network.network;
        }

        io.emit("usuariosOnline", Object.values(usuariosOnline));
    });

    // ----------------------------
    // Desconexão
    // ----------------------------
    socket.on("disconnect", () => {

        console.log("❌ Usuário desconectado:", socket.id);

        delete usuariosOnline[socket.id];

        io.emit("usuariosOnline", Object.values(usuariosOnline));
    });

});

// ----------------------------
// API histórico global
// ----------------------------
app.get("/locations", (req, res) => {

    res.json({
        total: locationHistory.length,
        locations: locationHistory.slice(0, 100)
    });

});

// ----------------------------
// API histórico por usuário
// ----------------------------
app.get("/locations/:userId", (req, res) => {

    const userLocations = locationHistory.filter(
        loc => loc.id === req.params.userId
    );

    res.json(userLocations.slice(0, 50));

});

// ----------------------------
// Start servidor
// ----------------------------
server.listen(3000, "0.0.0.0", () => {

    console.log("🚀 Servidor rodando em http://0.0.0.0:3000");
    console.log("📍 Tracking GPS ativo - Porta 3000");

});