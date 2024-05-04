const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User.js");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const Place = require("./models/Place.js");
//const Cookieparser = require("cookie-parser");
const cookieParser = require("cookie-parser");
const jwtsecret = 'sadgashjhjhjdasjkanjxsaw4d'
const bcryptSalt = bcrypt.genSaltSync(10);
const multer = require("multer");
const imageDownloader = require("image-downloader");
const fs = require("fs");
const BASE_URL = process.env.BASE_URL;
const port = process.env.PORT || 4000;
const Booking = require("./models/Booking.js");
require("dotenv").config()
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'))
// app.use(cors({
//     credentials: true,
//     origin: 'http://localhost:5173',

// }));
// Configure CORS
const corsOptions = {
    origin: "https://effulgent-valkyrie-bbaf59.netlify.app",
    credentials: true // Allow cookies to be sent from the frontend
};
app.use(cors(corsOptions));
app.get("/", (req, res) => {
    res.send("hello aditya!!");
});
mongoose.connect(process.env.MONGO_URL)
app.get("/test", (req, res) => {
    res.json("test ok");
})
function getUserDataFromReq(req) {
    return new Promise((resolve, reject) => {
        jwt.verify(req.cookies.token, jwtsecret, {}, async (err, userData) => {
            if (err) throw err;
            resolve(userData);
        });
    })

}

//register 
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
                res.cookie('token', token).json(userDoc)

            })
        }
        else {
            res.status(422).json("passowrd not ok")
        }

    }

    else {
        res.json("not found")
    }
})
app.get('/profile', (req, res) => {

    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, jwtsecret, {}, async (err, userData) => {
            if (err) throw err;
            const { name, email, _id } = await User.findById(userData.id);
            res.json({ name, email, _id });
        })
    }
    else
        res.json(null)
})

app.post("/logout", (req, res) => {
    res.cookie('token', "").json(true);
})
//adityakr4005
//FHqJeN2dSj66KTQ2
//console.log(__dirname)
app.post("/upload-by-link", async (req, res) => {
    const { link } = req.body;
    const newName = 'photo' + Date.now() + '.jpg';
    await imageDownloader.image({
        url: link,
        dest: __dirname + '/uploads/' + newName,
    });
    res.json(newName)

})

const photosMiddleWare = multer({ dest: "uploads/" });

app.post('/upload', photosMiddleWare.array('photos', 100), (req, res) => {
    const uploadedFiles = [];
    for (let i = 0; i < req.files.length; i++) {
        const { path, originalname } = req.files[i];
        const parts = originalname.split('.')
        const ext = parts[parts.length - 1];
        const newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
        uploadedFiles.push(newPath.replace('uploads\\', ''));
        //   console.log(fs.renameSync(path, newPath))
    }

    res.json(uploadedFiles);
})
app.post("/places", (req, res) => {
    const { token } = req.cookies;
    const { title, address, addedPhotos,
        perks, description,
        extraInfo, checkOut,
        checkIn, maxGuests, price } = req.body;
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
});

app.get("/user-places", (req, res) => {
    //grab userid using token
    const { token } = req.cookies;

    jwt.verify(token, jwtsecret, {}, async (err, userData) => {
        const { id } = userData;
        res.json(await Place.find({ owner: id }))
    })
})
app.get("/places/:id", async (req, res) => {
    const { id } = req.params;
    res.json(await Place.findById(id));
})

app.put("/places", async (req, res) => {
    const { token } = req.cookies;
    const { id, title, address, addedPhotos,
        perks, description,
        extraInfo, checkOut,
        checkIn, maxGuests, price } = req.body;
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

app.post("/bookings", async (req, res) => {
    const userData = await getUserDataFromReq(req);

    const { place, price, checkOut,
        checkIn, numberOfGuests, name, phone } = req.body;
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

app.get("/bookings", async (req, res) => {
    const userData = await getUserDataFromReq(req);
    res.json(await Booking.find({ user: userData.id }).populate('place'))
})

// app.listen(4000);
app.listen(port, () => {
    console.log(`App listening on ${port}`);
});