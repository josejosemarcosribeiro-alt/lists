const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcryptjs');

// Models
const list_item = require('../models/listitem');
const User = require('../models/user');

// Cloudinary config
cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
});

// Multer + CloudinaryStorage config
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'videos',
        resource_type: 'video',
        format: 'mp4',
        public_id: (req, file) => Date.now() + '-' + file.originalname
    }
});
const upload = multer({ storage });

// --- Função de autenticação ---
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    req.flash('danger', 'Por favor, faça login.');
    res.redirect('/users/login');
}

// --- ROTAS DE SIGNUP MULTI-ETAPA ---

// ETAPA 1 - EMAIL
router.get('/register', (req, res) => {
    res.render('register', { email: req.session.newUser?.email || '' });
});

router.post('/register', async (req, res) => {
    const email = req.body.email?.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
        req.flash('danger', 'O email é obrigatório!');
        return res.redirect('/register');
    }
    if (!emailRegex.test(email)) {
        req.flash('danger', 'O email informado não é válido!');
        return res.redirect('/register');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        req.flash('danger', 'Este email já está em uso!');
        return res.redirect('/register');
    }

    req.session.newUser = req.session.newUser || {};
    req.session.newUser.email = email;
    res.redirect('/register/step2');
});

// ETAPA 2 - SENHA
router.get('/register/step2', (req, res) => {
    res.render('register-step1');
});

router.post('/register/step2', (req, res) => {
    const password = req.body.password?.trim();
    if (!password || password.length < 6) {
        req.flash('danger', 'A senha é obrigatória e deve ter pelo menos 6 caracteres!');
        return res.redirect('/register/step2');
    }

    req.session.newUser.password = password;
    res.redirect('/register/step3');
});

// ETAPA 3 - NOME / FINALIZA
router.get('/register/step3', (req, res) => {
    res.render('register-name');
});

router.post('/register/step3', async (req, res) => {
    try {
        const nomeCompleto = req.body.nomeCompleto?.trim();
        const username = req.body.username?.trim() || nomeCompleto;

        if (!nomeCompleto) {
            req.flash('danger', 'O nome completo é obrigatório!');
            return res.redirect('/register/step3');
        }

        // Criptografar senha
        const hashedPassword = await bcrypt.hash(req.session.newUser.password, 10);

        const newUser = new User({
            email: req.session.newUser.email,
            password: hashedPassword,
            username,
            nomeCompleto
        });

        await newUser.save();

        req.session.newUser = null;
        req.flash('success', 'Usuário cadastrado com sucesso!');
        res.redirect('/users/login');
    } catch (err) {
        console.error('Erro registrando usuário:', err);
        req.flash('danger', 'Erro ao cadastrar usuário');
        res.redirect('/register');
    }
});

// --- ROTAS DE LISTA/POSTAGEM ---

router.get('/add', ensureAuthenticated, (req, res) => {
    if (!process.env.CLOUDINARY_UPLOAD_PRESET) {
        req.flash('danger', 'Erro: Cloudinary upload preset não configurado!');
        return res.redirect('back');
    }

    res.render('add_list', {
        cloudName: cloudinary.config().cloud_name,
        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
    });
});

router.post('/add', ensureAuthenticated, upload.single('video'), async (req, res) => {
    try {
        const { title, body } = req.body;

        if (!title?.trim() || !body?.trim()) {
            req.flash('danger', 'Título e descrição são obrigatórios!');
            return res.redirect('/add');
        }

        const item = new list_item({
            title: title.trim(),
            body: body.trim(),
            author: req.user._id
        });

        if (req.file) {
            item.videoPath = req.file.path;
            item.videoPublicId = req.file.filename;
        } else if (req.body.video) {
            item.videoPath = req.body.video;
            item.videoPublicId = null;
        }

        await item.save();
        req.flash('success', 'Aula adicionada com sucesso!');
        res.redirect('/');
    } catch (err) {
        console.error('Erro adicionando aula:', err);
        req.flash('danger', 'Erro ao adicionar aula');
        res.redirect('back');
    }
});

// --- Editar aula ---
router.get('/item/edit/:id', ensureAuthenticated, async (req, res) => {
    try {
        const item = await list_item.findById(req.params.id);
        if (!item || item.author.toString() !== req.user._id.toString()) {
            req.flash('danger', 'Não autorizado');
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

router.post('/edit/:id', ensureAuthenticated, upload.single('video'), async (req, res) => {
    try {
        const item = await list_item.findById(req.params.id);
        if (!item || item.author.toString() !== req.user._id.toString()) {
            req.flash('danger', 'Não autorizado');
            return res.redirect('/');
        }

        const title = req.body.title?.trim();
        const body = req.body.body?.trim();
        if (!title || !body) {
            req.flash('danger', 'Título e descrição são obrigatórios!');
            return res.redirect('back');
        }

        item.title = title;
        item.body = body;

        if (req.file) {
            if (item.videoPublicId) {
                await cloudinary.uploader.destroy(item.videoPublicId, { resource_type: 'video' });
            }
            item.videoPath = req.file.path;
            item.videoPublicId = req.file.filename;
        } else if (req.body.video) {
            if (item.videoPublicId) {
                await cloudinary.uploader.destroy(item.videoPublicId, { resource_type: 'video' });
            }
            item.videoPath = req.body.video;
            item.videoPublicId = null;
        }

        await item.save();
        req.flash('success', 'Aula editada com sucesso!');
        res.redirect('/');
    } catch (err) {
        console.error('Erro editando aula:', err);
        req.flash('danger', 'Erro ao editar aula');
        res.redirect('back');
    }
});

// --- Deletar vídeo ---
router.post('/delete-video/:id', ensureAuthenticated, async (req, res) => {
    try {
        const item = await list_item.findById(req.params.id);
        if (!item || item.author.toString() !== req.user._id.toString()) {
            req.flash('danger', 'Não autorizado');
            return res.redirect('back');
        }

        if (item.videoPublicId) {
            await cloudinary.uploader.destroy(item.videoPublicId, { resource_type: 'video' });
        }

        item.videoPath = '';
        item.videoPublicId = '';
        await item.save();

        req.flash('success', 'Vídeo deletado com sucesso!');
        res.redirect('back');
    } catch (err) {
        console.error('Erro deletando vídeo:', err);
        req.flash('danger', 'Erro ao deletar vídeo');
        res.redirect('back');
    }
});

// --- Ver aula ---
router.get('/item/:id', async (req, res) => {
    try {
        const item = await list_item.findById(req.params.id);
        if (!item) {
            req.flash('danger', 'Aula não encontrada');
            return res.redirect('/');
        }

        const user = await User.findById(item.author);
        const authorName = user ? (user.nomeCompleto || user.username) : 'Autor Desconhecido';

        res.render('item', { item, author: authorName });
    } catch (err) {
        console.error(err);
        req.flash('danger', 'Erro ao carregar aula');
        res.redirect('/');
    }
});

// --- Deletar aula ---
router.delete('/item/:id', async (req, res) => {
    try {
        const item = await list_item.findById(req.params.id);
        if (!req.user?._id || item.author.toString() !== req.user._id.toString()) {
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

module.exports = router;
