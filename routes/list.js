const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Models
let list_item = require('../models/listitem');
let User = require('../models/user');

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
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

// Add new Aula
router.get('/add', ensureAuthenticated, (req, res) => {
    res.render('add_list');
});

router.post('/add', ensureAuthenticated, upload.single('video'), async (req, res) => {
    try {
        req.checkBody('title', 'Title is required').notEmpty();
        req.checkBody('body', 'Body is required').notEmpty();

        let errors = req.validationErrors();
        if (errors) {
            return res.render('add_list', { errors: errors });
        }

        let item = new list_item();
        item.title = req.body.title;
        item.author = req.user._id;
        item.body = req.body.body;

        if (req.file) {
            item.videoPath = req.file.path; // URL do Cloudinary
            item.videoPublicId = req.file.filename; // Salva public_id para deletar depois
        }

        await item.save();
        req.flash('success', 'Aula Added!');
        res.redirect('/');
    } catch (err) {
        console.log(err);
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
        res.render('edit_item', { item: item });
    } catch (err) {
        console.log(err);
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

        // Substituir vídeo antigo se houver novo upload
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
        console.log(err);
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
        console.log(err);
        req.flash('danger', 'Error deleting video');
        res.redirect('back');
    }
});

// Get Aula
router.get('/item/:id', async (req, res) => {
    try {
        let item = await list_item.findById(req.params.id);
        let user = await User.findById(item.author);
        res.render('item', { item: item, author: user.name });
    } catch (err) {
        console.log(err);
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
        console.log(err);
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
