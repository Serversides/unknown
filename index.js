const express = require('express');
const EventEmitter = require('events').EventEmitter;
const axios = require('axios');

const EVENT_NAME = 'Print';
const REQUEST_TIMEOUT = 30000;
const ROBLOX_GROUP_ID = 35246816; // Change to your Roblox group ID

const app = express();
const printEvents = new Map();

app.use(express.json());

// ✅ Function to get a player's ID from their username
async function getUserId(username) {
    try {
        let response = await axios.get(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=1`);
        if (!response.data || !response.data.data || response.data.data.length === 0) {
            return null; // User not found
        }
        return response.data.data[0].id;
    } catch (error) {
        console.error("Error fetching user ID:", error);
        return null;
    }
}

// ✅ Function to check if a player is in the Roblox group using their user ID
async function isPlayerInGroup(userId) {
    try {
        let response = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        let groups = response.data.data;

        return groups.some(group => group.group.id === ROBLOX_GROUP_ID);
    } catch (error) {
        console.error("Error checking group membership:", error);
        return false;
    }
}

// ✅ API: Check if user is whitelisted (in Roblox group)
app.get('/api/checkGroupWhitelist', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json({ isWhitelisted: false });

    const userId = await getUserId(username);
    if (!userId) return res.json({ isWhitelisted: false });

    const isWhitelisted = await isPlayerInGroup(userId);
    res.json({ isWhitelisted });
});

// ✅ API: Request to execute a script
app.post('/api/printRequest', async (req, res) => {
    const { username, script, jobId } = req.body;
    if (!username || !script || !jobId) {
        return res.sendStatus(400);
    }

    const userId = await getUserId(username);
    if (!userId) return res.status(403).json({ error: "User not found." });

    const isWhitelisted = await isPlayerInGroup(userId);
    if (!isWhitelisted) {
        return res.status(403).json({ error: "User is not in the required group." });
    }

    if (!printEvents.has(jobId)) {
        printEvents.set(jobId, new EventEmitter());
    }

    printEvents.get(jobId).emit(EVENT_NAME, username);
    res.sendStatus(200);
});

// ✅ API: Fetch pending execution requests
app.get('/api/fetchPrintRequests', (req, res) => {
    const { jobId } = req.query;
    if (!jobId || !printEvents.has(jobId)) {
        return res.sendStatus(400);
    }

    let timeout;
    const listener = (username) => {
        clearTimeout(timeout);
        res.json({ username });
    };

    const eventEmitter = printEvents.get(jobId);
    eventEmitter.once(EVENT_NAME, listener);

    timeout = setTimeout(() => {
        eventEmitter.removeListener(EVENT_NAME, listener);
        res.sendStatus(500);
    }, REQUEST_TIMEOUT);
});

// ✅ Vercel requires this for deployment
module.exports = app;
