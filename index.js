const express = require('express');
const EventEmitter = require('events').EventEmitter;
const axios = require('axios');

const EVENT_NAME = 'Print';
const REQUEST_TIMEOUT = 30000;
const ROBLOX_GROUP_ID = 35766474; // Change to your Roblox group ID

const app = express();
const printEvents = new Map();

app.use(express.json());

// ✅ API: Check if user is whitelisted (using `userId` directly)
app.get('/api/checkGroupWhitelist', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.json({ isWhitelisted: false });

    const isWhitelisted = await isPlayerInGroup(userId);
    res.json({ isWhitelisted });
});

// ✅ Function to check if a player is in the Roblox group using `userId`
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

// ✅ API: Request to execute a script (Now using `userId`)
app.post('/api/printRequest', async (req, res) => {
    const { userId, script, jobId } = req.body;
    if (!userId || !script || !jobId) {
        return res.sendStatus(400);
    }

    const isWhitelisted = await isPlayerInGroup(userId);
    if (!isWhitelisted) {
        return res.status(403).json({ error: "User is not in the required group." });
    }

    if (!printEvents.has(jobId)) {
        printEvents.set(jobId, new EventEmitter());
    }

    printEvents.get(jobId).emit(EVENT_NAME, userId);
    res.sendStatus(200);
});

// ✅ API: Fetch pending execution requests
app.get('/api/fetchPrintRequests', (req, res) => {
    const { jobId } = req.query;
    if (!jobId || !printEvents.has(jobId)) {
        return res.sendStatus(400);
    }

    let timeout;
    const listener = (userId) => {
        clearTimeout(timeout);
        res.json({ userId });
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
