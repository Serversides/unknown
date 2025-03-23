const express = require("express");
const axios = require("axios");

const ROBLOX_GROUP_ID = 35766474; // Your Roblox Group ID
const app = express();

app.use(express.json());

// Function to check if a user is in the Roblox group
async function isPlayerInGroup(userId) {
    try {
        let groupResponse = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        let groups = groupResponse.data.data;

        return groups.some(group => group.group.id === ROBLOX_GROUP_ID);
    } catch (error) {
        console.error("Error checking group membership:", error);
        return false;
    }
}

// API: Check if user is whitelisted (in Roblox group)
app.get("/api/checkGroupWhitelist", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.json({ isWhitelisted: false });

    const isWhitelisted = await isPlayerInGroup(userId);
    res.json({ isWhitelisted });
});

// API: Request to execute a script (Removed JobId)
app.post("/api/printRequest", async (req, res) => {
    const { userId, script } = req.body;
    if (!userId || !script) {
        return res.sendStatus(400);
    }

    const isWhitelisted = await isPlayerInGroup(userId);
    if (!isWhitelisted) {
        return res.status(403).json({ error: "User is not in the required group." });
    }

    res.sendStatus(200);
});

// Vercel requires exporting the app
module.exports = app;
