const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User.js");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const Place = require("./models/Place.js");
const jwtsecret = 'sadgashjhjhjdasjkanjxsaw4d';
const bcryptSalt = bcrypt.genSaltSync(10);
const multer = require("multer");
const imageDownloader = require("image-downloader");
const fs = require("fs");
const BASE_URL = process.env.BASE_URL;
const port = process.env.PORT || 4000;
const Booking = require("./models/Booking.js");
const app = express();

app.use(express.json());
app.use('/uploads', express.static(__dirname + '/uploads'))

app.use(cors({
    origin: 'https://air-bnb-clone1.netlify.app',
    credentials: true,
}));

try {
    mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true });
    console.log("Connected to MongoDB");
} catch (err) {
    console.error("Error connecting to MongoDB:", err);
    throw err;
}

function getUserDataFromReq(req) {
    return new Promise((resolve, reject) => {
        const token = req.headers.authorization.split(" ")[1];
        if (!token) {
            reject(new Error('JWT token not provided'));
            return;
        }
        jwt.verify(token, jwtsecret, {}, async (err, userData) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(userData);
        });
    });
}

function extractToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new Error("Authorization header missing or invalid");
        }
        const token = authHeader.split(" ")[1];
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
}

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userDoc = await User.create({
            name,
            email,
            password: bcrypt.hashSync(password, bcryptSalt),
        });
        res.json(userDoc);
    }
    catch (e) {
        res.status(422).json(e);
    }
})

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const userDoc = await User.findOne({ email });
    if (userDoc) {
        const passOk = bcrypt.compareSync(password, userDoc.password)
        if (passOk) {
            jwt.sign({
                email: userDoc.email,
                id: userDoc._id,
            }, jwtsecret, {}, (err, token) => {
                if (err) throw err;
                res.json({ token, userDoc });
            })
        } else {
            res.status(422).json("password not ok")
        }
    } else {
        res.status(404).json("User not found");
    }
})

app.get('/profile', extractToken, async (req, res) => {
    try {
        const userData = jwt.verify(req.token, jwtsecret);
        const { name, email, _id } = await User.findById(userData.id);
        res.json({ name, email, _id });
    } catch (error) {
        res.status(401).json({ error: "Invalid token" });
    }
})

app.post("/places", extractToken, async (req, res) => {
    const token = req.token;
    const { title, address, addedPhotos, perks, description, extraInfo, checkOut, checkIn, maxGuests, price } = req.body;
    jwt.verify(token, jwtsecret, {}, async (err, userData) => {
        if (err) throw err;
        const placeDoc = await Place.create({
            owner: userData.id,
            title, address, photos: addedPhotos,
            perks, description,
            extraInfo, checkOut,
            checkIn, maxGuests,
            price,
        });
        res.json(placeDoc)
    });
})

app.get("/user-places", extractToken, async (req, res) => {
    const token = req.token;
    jwt.verify(token, jwtsecret, {}, async (err, userData) => {
        const { id } = userData;
        res.json(await Place.find({ owner: id }))
    })
})

app.get("/places/:id", extractToken, async (req, res) => {
    const token = req.token;
    const { id } = req.params;
    res.json(await Place.findById(id));
})

app.put("/places", extractToken, async (req, res) => {
    const token = req.token;
    const { id, title, address, addedPhotos, perks, description, extraInfo, checkOut, checkIn, maxGuests, price } = req.body;
    jwt.verify(token, jwtsecret, {}, async (err, userData) => {
        const placeDoc = await Place.findById(id);
        if (userData.id === placeDoc.owner.toString()) {
            placeDoc.set({
                title, address, photos: addedPhotos,
                perks, description,
                extraInfo, checkOut,
                checkIn, maxGuests,
                price
            })
            await placeDoc.save();
            res.json('ok');
        }
    })
})

app.get("/places", async (req, res) => {
    res.json(await Place.find());
})

app.post("/bookings", extractToken, async (req, res) => {
    const token = req.token;
    const userData = await getUserDataFromReq(req);
    const { place, price, checkOut, checkIn, numberOfGuests, name, phone } = req.body;
    Booking.create({
        place, checkIn, checkOut, price, name,
        user: userData.id,
        phone, numberOfGuests,
    }).then((doc) => {
        res.json(doc);
    }).catch((err) => {
        throw err;
    })
})
app.get("/bookings/:id", extractToken, async (req, res) => {
    try {
        const token = req.token;
        const userData = await getUserDataFromReq(req);
        const booking = await Booking.findOne({ _id: req.params.id, user: userData.id }).populate('place');
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }
        res.json(booking);
    } catch (err) {
        console.error("Error retrieving booking:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/bookings", extractToken, async (req, res) => {
    try {
        const token = req.token;
        const userData = await getUserDataFromReq(req);
        const bookings = await Booking.find({ user: userData.id }).populate('place');
        res.json(bookings);
    } catch (err) {
        console.error("Error retrieving bookings:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/logout", (req, res) => {
    res.json(true);
})

app.listen(port, () => {
    console.log(`App listening on ${port}`);
});
