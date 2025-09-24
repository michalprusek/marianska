const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

async function ensureDataFile() {
    const dir = path.dirname(DATA_FILE);
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }

    try {
        await fs.access(DATA_FILE);
    } catch {
        const initialData = {
            bookings: [],
            blockedDates: [],
            settings: {
                adminPassword: "admin123",
                christmasAccessCodes: ["XMAS2024"],
                christmasPeriod: {
                    start: "2024-12-23",
                    end: "2025-01-02"
                },
                rooms: [
                    { id: "12", name: "Pokoj 12", type: "small", beds: 2 },
                    { id: "13", name: "Pokoj 13", type: "small", beds: 3 },
                    { id: "14", name: "Pokoj 14", type: "large", beds: 4 },
                    { id: "22", name: "Pokoj 22", type: "small", beds: 2 },
                    { id: "23", name: "Pokoj 23", type: "small", beds: 3 },
                    { id: "24", name: "Pokoj 24", type: "large", beds: 4 },
                    { id: "42", name: "Pokoj 42", type: "small", beds: 2 },
                    { id: "43", name: "Pokoj 43", type: "small", beds: 2 },
                    { id: "44", name: "Pokoj 44", type: "large", beds: 4 }
                ],
                prices: {
                    utia: {
                        small: { base: 300, adult: 50, child: 25 },
                        large: { base: 400, adult: 50, child: 25 }
                    },
                    external: {
                        small: { base: 500, adult: 100, child: 50 },
                        large: { base: 600, adult: 100, child: 50 }
                    }
                }
            }
        };
        await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}

app.get('/api/data', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.post('/api/data', async (req, res) => {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

app.post('/api/booking', async (req, res) => {
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
        const booking = req.body;
        booking.id = 'BK' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
        booking.editToken = Math.random().toString(36).substr(2, 15);
        booking.createdAt = new Date().toISOString();
        booking.updatedAt = new Date().toISOString();

        data.bookings.push(booking);
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));

        res.json({ success: true, booking });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

app.put('/api/booking/:id', async (req, res) => {
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
        const index = data.bookings.findIndex(b => b.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        data.bookings[index] = { ...data.bookings[index], ...req.body, updatedAt: new Date().toISOString() };
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));

        res.json({ success: true, booking: data.bookings[index] });
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({ error: 'Failed to update booking' });
    }
});

app.delete('/api/booking/:id', async (req, res) => {
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
        data.bookings = data.bookings.filter(b => b.id !== req.params.id);
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: 'Failed to delete booking' });
    }
});

async function start() {
    await ensureDataFile();
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

start();