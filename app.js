const express = require('express');
const path  = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
require('dotenv').config(); // variáveis de ambiente
const config = require('./config/database');

// --- Connect to MongoDB ---
let dburl = process.env.MONGODB_URI || config.database;
mongoose.connect(dburl, { useNewUrlParser: true, useUnifiedTopology: true });
let db = mongoose.connection;
db.once('open', () => console.log('Connected to MongoDB...'));
db.on('error', (err) => console.log(err));

// --- Init app ---
const app = express();

// --- Models ---
let list_item = require('./models/listitem');

// --- View engine ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// --- Body Parser ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- Public folder ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Express session ---
app.set('trust proxy', 1);
app.use(session({
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: dburl })
}));

// --- Connect flash ---
app.use(flash());
app.use((req, res, next) => {
    res.locals.messages = require('express-messages')(req, res);
    next();
});

// --- Passport config ---
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// --- Make user available in templates ---
app.use('*', (req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// --- Auth middleware ---
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    req.flash('danger', 'Please login');
    res.redirect('/users/login');
}

// --- ROUTES ---
let list = require('./routes/list');
let users = require('./routes/users');

// Mount routes
app.use('/list', list);
app.use('/users', users);

// --- HOME ROUTE ---
app.get('/', async (req, res) => {
    try {
        const list_items = await list_item.find({}).lean();
        res.render('index', { list_items });
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
});

// --- Protected route: Add Aula ---
app.get('/add-aula', ensureAuthenticated, (req, res) => {
    res.redirect('/list/add'); // encaminha para rota de adicionar aula
});

// --- Logout route ---
app.get('/logout', (req, res) => {
    req.logout(err => {
        if (err) console.error(err);
        req.flash('success', 'You are logged out');
        res.redirect('/');
    });
});

// --- ERROR HANDLER GLOBAL ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Internal Server Error');
});

// --- START SERVER ---
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server started on port ${port}...`));
