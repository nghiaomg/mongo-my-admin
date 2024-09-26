const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const MongoClient = require('mongodb').MongoClient;
const { ObjectId } = require('mongodb');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

let mongoUrl = '';

app.get('/', (req, res) => {
    res.render('connect');
});

app.get('/connect', async (req, res) => {
    mongoUrl = req.query.mongoUrl || 'mongodb://localhost:27017';
    try {
        await mongoose.connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        res.redirect(`/databases?mongoUrl=${encodeURIComponent(mongoUrl)}`);
    } catch (error) {
        res.render('connect', {
            error: 'Không thể kết nối đến cơ sở dữ liệu. Vui lòng kiểm tra URL.'
        });
    }
});

app.get('/databases', async (req, res) => {
    try {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            throw new Error('Không có kết nối đến MongoDB');
        }
        const adminDb = mongoose.connection.db.admin();
        const dbList = await adminDb.listDatabases();
        res.render('databases', { 
            title: 'Danh sách Databases',
            databases: dbList.databases.map(db => db.name),
            mongoUrl: req.query.mongoUrl || ''
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách databases:', error);
        res.status(500).render('error', { 
            title: 'Lỗi',
            message: 'Lỗi khi lấy danh sách databases', 
            error: error.message 
        });
    }
});

app.get('/collections', async (req, res) => {
    let client;
    try {
        console.log('Bắt đầu xử lý route /collections');
        const dbName = req.query.database;
        const mongoUrl = req.query.mongoUrl;

        console.log('Database:', dbName);
        console.log('MongoDB URL:', mongoUrl);

        if (!dbName) {
            console.log('Thiếu tham số database');
            return res.status(400).render('error', {
                title: 'Lỗi',
                message: 'Thiếu tham số database',
                error: 'Vui lòng cung cấp tên database'
            });
        }

        console.log('Kết nối với MongoDB');
        client = await MongoClient.connect(mongoUrl, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000 // 5 giây timeout
        });

        const db = client.db(dbName);

        console.log('Bắt đầu lấy danh sách collections');
        const collections = await db.listCollections().toArray();
        console.log('Số lượng collections:', collections.length);

        console.log('Lấy danh sách databases');
        const adminDb = client.db().admin();
        const dbList = await adminDb.listDatabases();

        console.log('Render view collections');
        res.render('collections', { 
            title: `Collections trong ${dbName}`,
            databases: dbList.databases.map(db => db.name),
            currentDb: dbName,
            dbName: dbName,
            collections: collections.map(c => c.name),
            mongoUrl: mongoUrl || ''
        });
    } catch (error) {
        console.error('Lỗi khi xử lý route /collections:', error);
        res.status(500).render('error', {
            title: 'Lỗi',
            message: 'Lỗi khi lấy danh sách collections',
            error: error.message
        });
    } finally {
        if (client) {
            await client.close();
        }
    }
});

app.get('/documents', async (req, res) => {
    let client;
    try {
        console.log('Bắt đầu xử lý route /documents');
        const { database: dbName, collection: collectionName, mongoUrl } = req.query;

        console.log('Database:', dbName);
        console.log('Collection:', collectionName);
        console.log('MongoDB URL:', mongoUrl);

        if (!dbName || !collectionName) {
            console.log('Thiếu tham số database hoặc collection');
            return res.status(400).render('error', {
                title: 'Lỗi',
                message: 'Thiếu tham số database hoặc collection',
                error: 'Vui lòng cung cấp tên database và collection'
            });
        }

        console.log('Kết nối với MongoDB');
        client = await MongoClient.connect(mongoUrl, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000 // 5 giây timeout
        });

        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        console.log('Bắt đầu lấy dữ liệu từ collection');
        const documents = await collection.find().limit(20).toArray();
        console.log('Số lượng documents:', documents.length);

        console.log('Lấy danh sách databases');
        const adminDb = client.db().admin();
        const dbList = await adminDb.listDatabases();

        console.log('Lấy danh sách collections');
        const collections = await db.listCollections().toArray();

        console.log('Render view documents');
        res.render('documents', { 
            title: `Documents trong ${collectionName}`,
            databases: dbList.databases.map(db => db.name),
            currentDb: dbName,
            dbName: dbName,
            collections: collections.map(c => c.name),
            currentCollection: collectionName,
            documents: documents,
            mongoUrl: mongoUrl || ''
        });
    } catch (error) {
        console.error('Lỗi khi xử lý route /documents:', error);
        res.status(500).render('error', {
            title: 'Lỗi',
            message: 'Lỗi khi lấy dữ liệu từ collection',
            error: error.message
        });
    } finally {
        if (client) {
            await client.close();
        }
    }
});

app.post('/documents/add', async (req, res) => {
    let client;
    try {
        const { database, collection, mongoUrl, document } = req.body;
        client = await MongoClient.connect(mongoUrl);
        const db = client.db(database);
        const result = await db.collection(collection).insertOne(document);
        res.json({ success: true, insertedId: result.insertedId });
    } catch (error) {
        console.error('Error adding document:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) await client.close();
    }
});

app.post('/documents/update', async (req, res) => {
    console.log('Update route hit');
    let client;
    try {
        const { database, collection, mongoUrl, documentId, document } = req.body;
        
        const { _id, ...updateData } = document;
        
        client = await MongoClient.connect(mongoUrl);
        const db = client.db(database);
        const result = await db.collection(collection).updateOne(
            { _id: new ObjectId(documentId) },
            { $set: updateData }
        );
        res.json({ success: true, modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error('Error updating document:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) await client.close();
    }
});

app.post('/documents/delete', async (req, res) => {
    let client;
    try {
        const { database, collection, mongoUrl, documentId } = req.body;
        client = await MongoClient.connect(mongoUrl);
        const db = client.db(database);
        const result = await db.collection(collection).deleteOne({ _id: new ObjectId(documentId) });
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) await client.close();
    }
});

app.post('/collections/add', async (req, res) => {
    let client;
    try {
        const { database, mongoUrl, collectionName } = req.body;
        client = await MongoClient.connect(mongoUrl);
        const db = client.db(database);
        await db.createCollection(collectionName);
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding collection:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) await client.close();
    }
});

app.post('/collections/update', async (req, res) => {
    let client;
    try {
        const { database, mongoUrl, oldName, newName } = req.body;
        client = await MongoClient.connect(mongoUrl);
        const db = client.db(database);
        await db.collection(oldName).rename(newName);
        res.json({ success: true });
    } catch (error) {
        console.error('Error renaming collection:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) await client.close();
    }
});

app.post('/collections/delete', async (req, res) => {
    let client;
    try {
        const { database, mongoUrl, collectionName } = req.body;
        client = await MongoClient.connect(mongoUrl);
        const db = client.db(database);
        await db.collection(collectionName).drop();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting collection:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (client) await client.close();
    }
});

mongoose.connection.on('connected', () => {
    console.log('Mongoose đã kết nối');
});

mongoose.connection.on('error', (err) => {
    console.error('Lỗi kết nối Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose đã ngắt kết nối');
});

app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
});