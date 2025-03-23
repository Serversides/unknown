const express = require('express');
const EventEmitter = require('events').EventEmitter;
const axios = require('axios');

const EVENT_NAME = 'Print';
const REQUEST_TIMEOUT = 30000;
const ROBLOX_GROUP_ID = 35246816; // Change this to your Roblox group ID

const app = express();
const printEvents = new Map();

app.use(express.json());

// Function to check if a player is in the Roblox group
async function isPlayerInGroup(username) {
    try {
        // Get user ID from username
        let userResponse = await axios.get(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=1`);
        if (!userResponse.data || !userResponse.data.data || userResponse.data.data.length === 0) {
            return false;
        }

        let userId = userResponse.data.data[0].id;

        // Check if user is in the group
        let groupResponse = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        let groups = groupResponse.data.data;

        return groups.some(group => group.group.id === ROBLOX_GROUP_ID);
    } catch (error) {
        console.error("Error checking group membership:", error);
        return false;
    }
}

// API: Check if user is whitelisted (in Roblox group)
app.get('/api/checkGroupWhitelist', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json({ isWhitelisted: false });

    const isWhitelisted = await isPlayerInGroup(username);
    res.json({ isWhitelisted });
});

// API: Request to execute a script
app.post('/api/printRequest', async (req, res) => {
    const { username, script, jobId } = req.body;
    if (!username || !script || !jobId) {
        return res.sendStatus(400);
    }

    const isWhitelisted = await isPlayerInGroup(username);
    if (!isWhitelisted) {
        return res.status(403).json({ error: "User is not in the required group." });
    }

    if (!printEvents.has(jobId)) {
        printEvents.set(jobId, new EventEmitter());
    }

    printEvents.get(jobId).emit(EVENT_NAME, username);
    res.sendStatus(200);
});

// API: Fetch pending execution requests
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

// Vercel requires exporting the app
module.exports = app;
