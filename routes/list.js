const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Models
let list_item = require('../models/listitem');
let User = require('../models/user');

// Cloudinary configuration
cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
});

// Multer + CloudinaryStorage configuration
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'videos',
        resource_type: 'video',
        format: async (req, file) => 'mp4',
        public_id: (req, file) => Date.now() + '-' + file.originalname
    }
});
const upload = multer({ storage: storage });

// --- ROTAS ---

// Step 1: get email
router.get('/register/step1', (req, res) => {
    res.render('register_step1', { email: req.session.newUser?.email || '' });
});

router.post('/register/step1', (req, res) => {
    req.session.newUser = req.session.newUser || {};
    req.session.newUser.email = req.body.email;
    res.redirect('/register/step2');
});

// Step 2: get password
router.get('/register/step2', (req, res) => {
    res.render('register_step2');
});

router.post('/register/step2', (req, res) => {
    req.session.newUser.password = req.body.password;
    res.redirect('/register/step3');
});

// Step 3: get username and full name
router.get('/register/step3', (req, res) => {
    res.render('register_step3');
});

router.post('/register/step3', async (req, res) => {
    try {
        req.session.newUser.username = req.body.username;
        req.session.newUser.nomeCompleto = req.body.nomeCompleto;

        const newUser = new User(req.session.newUser);
        await newUser.save();

        req.session.newUser = null;
        req.flash('success', 'User registered successfully!');
        res.redirect('/users/login');
    } catch (err) {
        console.error('Error registering user:', err);
        req.flash('danger', 'Error registering user');
        res.redirect('/register/step1');
    }
});

// Add new Aula
router.get('/add', ensureAuthenticated, (req, res) => {
    res.render('add_list', {
        cloudName: cloudinary.config().cloud_name,
        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
    });
});

router.post('/add', ensureAuthenticated, upload.single('video'), async (req, res) => {
    try {
        if (!req.body.title || !req.body.body) {
            req.flash('danger', 'Title and Body are required');
            return res.redirect('/add');
        }

        let item = new list_item();
        item.title = req.body.title;
        item.author = req.user._id;
        item.body = req.body.body;

        if (req.file) {
            item.videoPath = req.file.path;
            item.videoPublicId = req.file.filename;
        }

        await item.save();
        req.flash('success', 'Aula Added!');
        res.redirect('/');
    } catch (err) {
        console.error('Error adding Aula:', err);
        req.flash('danger', 'Error adding Aula');
        res.redirect('back');
    }
});

// Edit Aula page
router.get('/item/edit/:id', ensureAuthenticated, async (req, res) => {
    try {
        let item = await list_item.findById(req.params.id);
        if (!item || item.author != req.user._id) {
            req.flash('danger', 'Not authenticated');
            return res.redirect('/');
        }
        res.render('edit_item', {
            item,
            cloudName: cloudinary.config().cloud_name,
            uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// Edit Aula action
router.post('/edit/:id', ensureAuthenticated, upload.single('video'), async (req, res) => {
    try {
        let item = await list_item.findById(req.params.id);
        if (!item || item.author != req.user._id) {
            req.flash('danger', 'Not authenticated');
            return res.redirect('/');
        }

        item.title = req.body.title;
        item.body = req.body.body;

        if (req.file) {
            if (item.videoPublicId) {
                await cloudinary.uploader.destroy(item.videoPublicId, { resource_type: 'video' });
            }
            item.videoPath = req.file.path;
            item.videoPublicId = req.file.filename;
        }

        await item.save();
        req.flash('success', 'Aula Edited!');
        res.redirect('/');
    } catch (err) {
        console.error('Error editing Aula:', err);
        req.flash('danger', 'Error editing Aula');
        res.redirect('back');
    }
});

// Delete only video
router.post('/delete-video/:id', ensureAuthenticated, async (req, res) => {
    try {
        let item = await list_item.findById(req.params.id);
        if (!item || item.author != req.user._id) {
            req.flash('danger', 'Not authenticated');
            return res.redirect('back');
        }

        if (item.videoPublicId) {
            await cloudinary.uploader.destroy(item.videoPublicId, { resource_type: 'video' });
            item.videoPath = '';
            item.videoPublicId = '';
            await item.save();
        }

        req.flash('success', 'Video deleted successfully!');
        res.redirect('back');
    } catch (err) {
        console.error('Error deleting video:', err);
        req.flash('danger', 'Error deleting video');
        res.redirect('back');
    }
});

// Get Aula
router.get('/item/:id', async (req, res) => {
    try {
        let item = await list_item.findById(req.params.id);
        let user = await User.findById(item.author);
        res.render('item', { item, author: user.nomeCompleto || user.username });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// Delete Aula
router.delete('/item/:id', async (req, res) => {
    try {
        let item = await list_item.findById(req.params.id);
        if (!req.user._id || item.author != req.user._id) {
            return res.status(500).send();
        }

        if (item.videoPublicId) {
            await cloudinary.uploader.destroy(item.videoPublicId, { resource_type: 'video' });
        }

        await list_item.deleteOne({ _id: req.params.id });
        res.send('Success');
    } catch (err) {
        console.error(err);
        res.status(500).send();
    }
});

// --- Função de autenticação ---
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        req.flash('danger', 'Please login');
        res.redirect('/users/login');
    }
}

module.exports = router;
