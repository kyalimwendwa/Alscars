const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { Client } = require('@elastic/elasticsearch');
const app = express();
const port = 3000;

// Configure PostgreSQL
const pool = new Pool({
  user: 'postgresql',
  host: 'database-1.cxiqek8mcodj.eu-west-2.rds.amazonaws.com', // Change 'localhost' to your host machine IP address or use 'host.docker.internal' to refer to the host machine
  database: 'projects',
  password: 'Aroot2024',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20
});





const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
app.set('view engine', 'ejs');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: '@Broot452wqrg', resave: false, saveUninitialized: true }));

// Routes
// ... (your existing code)
app.get('/', async (req, res) => {
    try {
      const makes = await pool.query('SELECT DISTINCT make FROM cars');
      const result = await pool.query('SELECT mainImage, stock, price, model, body,make FROM cars');
  
      const cars = result.rows;
      const currentIndex = req.query.index || 0;
  
      if (!cars[currentIndex]) {
        return res.status(404).send('No more cars available.');
      }
  
      const deals = cars.map((car) => {
        const mainImageBuffer = car.mainimage;
        const mainImageBase64 = mainImageBuffer ? mainImageBuffer.toString('base64') : null;
        return { ...car, mainImage: mainImageBase64 };
      });
  
      res.render('index', { deals, makes: makes.rows, currentIndex });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  
  
  
  
  
  



app.get('/signup', (req, res) => {
    res.render('signup')
});

app.get('/login', (req, res) => {
    res.render('login')
});

app.post('/signup', upload.single('input-file'), async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match');
    }

    const client = await pool.connect(); // Acquire a client from the pool

    try {
        await client.query('BEGIN'); // Start a transaction

        // Check if email already exists
        const emailExists = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailExists.rowCount > 0) {
            return res.status(400).send('Email already exists');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        let imageBuffer = null;

        // Check if a file has been uploaded
        if (req.file) {
            // Convert the buffer to a bytea hex string
            imageBuffer = req.file.buffer;
        }

        // Insert user into the database
        const result = await client.query('INSERT INTO users (name, email, password, profile) VALUES ($1, $2, $3, $4) RETURNING *', [name, email, hashedPassword, imageBuffer]);

        await client.query('COMMIT'); // Commit the transaction

        if (result.rowCount === 1) {
            // Store user data in session
            req.session.userId = result.rows[0].id;
            res.redirect('/');
        } else {
            res.status(500).send('Error inserting record');
        }
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback the transaction on error
        console.error(error);
        res.status(500).send('Internal Server Error');
    } finally {
        client.release(); // Release the client back to the pool
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Retrieve user from the database
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
        // Compare hashed password
        const match = await bcrypt.compare(password, result.rows[0].password);

        if (match) {
            // Store user data in session
            req.session.userId = result.rows[0].id;
            res.redirect('/');
        } else {
            res.send('Invalid password');
        }
    } else {
        res.send('User not found');
    }
});


app.get('/models', async (req, res) => {
    try {
      const { make } = req.query;
      const models = await pool.query('SELECT DISTINCT model FROM cars WHERE make = $1', [make]);
      const modelNames = models.rows.map(row => row.model);
      res.json(modelNames);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });
  

 // Route to handle form submission and display search results
// Route to handle form submission and display search results
// Route to handle form submission and display search results
// Route to handle form submission and display search results
app.post('/search', async (req, res) => {
    const { make, model, year, price } = req.body;
  
    let query = 'SELECT * FROM cars WHERE 1 = 1';
  
    // Add filters based on form inputs
    if (make) query += ` AND make = '${make}'`;
    if (model) query += ` AND model = '${model}'`;
    if (year) query += ` AND year = '${year}'`;
    if (price) query += ` AND price = '${price}'`;
  
    try {
      const { rows } = await pool.query(query);
  
      // Convert mainImage to Base64 and add other attributes
      const deals = rows.map((car) => {
        const mainImageBuffer = car.mainimage;
        const mainImageBase64 = mainImageBuffer ? `data:image/jpeg;base64,${mainImageBuffer.toString('base64')}` : null;
        return { 
          ...car, 
          mainImage: mainImageBase64,
          price: car.price,
          stock: car.stock,
          condition: car.condition,
          engineFuel: car.enginefuel,
          transmission: car.transmission,
          engineSize: car.enginesize,
          year: car.year,
          mileage: car.mileage,
          body: car.body,
          train: car.train
        };
      });
  
      res.render('product', { cars: deals });
    } catch (error) {
      console.error('Error executing query', error);
      res.status(500).send('Internal Server Error');
    }
  });

// Add a new route to handle the product detail page
app.get('/product/:id', async (req, res) => {
  const productId = req.params.id;
 

  try {

  
    // Validate productId
    if (!Number.isInteger(parseInt(productId))) {
      console.log('Invalid product ID');
      return res.status(400).send('Invalid product ID');
    }

    // Increment the view count for the visited car in car_views table
    const updateQuery = 'INSERT INTO car_views (car_id, views) VALUES ($1, 1) ON CONFLICT (car_id) DO UPDATE SET views = car_views.views + 1';
    await pool.query(updateQuery, [productId]);

    


    const query = 'SELECT * FROM cars WHERE id = $1';
    const { rows } = await pool.query(query, [productId]);
    const car = rows[0];

    if (!car) {
      return res.status(404).send('Car not found');
    }

    // Get make of the current car
    const make = car.make;

    // Fetch similar cars with the same make
    const similarCarsQuery = 'SELECT * FROM cars WHERE make = $1 AND id != $2';
    const similarCarsResult = await pool.query(similarCarsQuery, [make, productId]);
    const similarCars = similarCarsResult.rows;

    // Clean data and convert comma-separated values to arrays
    const cleanData = {
      exterior: car.exterior.replace(/[\[\]"]+/g, ''),
      interior: car.interior.replace(/[\[\]"]+/g, ''),
      safety: car.safety.replace(/[\[\]"]+/g, ''),
    };

    const exteriorArray = cleanData.exterior.split(',').map(value => value.trim());
    const interiorArray = cleanData.interior.split(',').map(value => value.trim());
    const safetyArray = cleanData.safety.split(',').map(value => value.trim());
    
    // Map deals
    const images = rows.map((car) => {
      const mainImageBuffer = car.mainimage;
      const mainImageBase64 = mainImageBuffer ? `data:image/jpeg;base64,${Buffer.from(mainImageBuffer).toString('base64')}` : null;
      
      // Convert other images to base64
      const otherImagesBase64 = car.otherimages.map(imageBuffer => {
        return imageBuffer ? `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}` : null;
      });
      
      return { 
        ...car, 
        mainImage: mainImageBase64,
        otherImages: otherImagesBase64,
      };
    });


    const similarCarsWithImages = similarCars.map((similarCar) => {
      const mainImageBuffer = similarCar.mainimage;
      const mainImageBase64 = mainImageBuffer ? `data:image/jpeg;base64,${Buffer.from(mainImageBuffer).toString('base64')}` : null;
  
      // If mainImageBase64 is null or invalid, use the original mainImage from the database
      const mainImage = mainImageBase64 || similarCar.mainImage;
  
      // Convert other images to base64
      const otherImagesBase64 = similarCar.otherimages.map(imageBuffer => {
          return imageBuffer ? `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}` : null;
      });
  
      return { 
          ...similarCar, 
          mainImage: mainImage,
          otherImages: otherImagesBase64,
      };
  });
   

       
    // Render the product detail page passing the car details and similar cars
    res.render('productdetails', { cars: images , exteriorArray, interiorArray, safetyArray, similarCars: similarCarsWithImages  });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/used-cars', async (req, res) => {
  try {
      // Fetch used cars data from the database
      const query = "SELECT * FROM cars WHERE condition = 'Foreign Used' OR condition = 'Locally Used'";
      const { rows } = await pool.query(query);
      
      const deals = rows.map((car) => {
        const mainImageBuffer = car.mainimage;
        const mainImageBase64 = mainImageBuffer ? `data:image/jpeg;base64,${mainImageBuffer.toString('base64')}` : null;
        return { 
          ...car, 
          mainImage: mainImageBase64,
          price: car.price,
          stock: car.stock,
          condition: car.condition,
          engineFuel: car.enginefuel,
          transmission: car.transmission,
          engineSize: car.enginesize,
          year: car.year,
          mileage: car.mileage,
          body: car.body,
          train: car.train
        };
      });
  
      res.render('used', { cars: deals });
  } catch (error) {
      console.error('Error executing query', error);
      res.status(500).send('Internal Server Error');
  }
});

app.get('/new-cars', async (req, res) => {
  try {
      // Fetch used cars data from the database
      const query = "SELECT * FROM cars WHERE condition = 'New' ";
      const { rows } = await pool.query(query);
      
      const deals = rows.map((car) => {
        const mainImageBuffer = car.mainimage;
        const mainImageBase64 = mainImageBuffer ? `data:image/jpeg;base64,${mainImageBuffer.toString('base64')}` : null;
        return { 
          ...car, 
          mainImage: mainImageBase64,
          price: car.price,
          stock: car.stock,
          condition: car.condition,
          engineFuel: car.enginefuel,
          transmission: car.transmission,
          engineSize: car.enginesize,
          year: car.year,
          mileage: car.mileage,
          body: car.body,
          train: car.train
        };
      });
  
      res.render('used', { cars: deals });
  } catch (error) {
      console.error('Error executing query', error);
      res.status(500).send('Internal Server Error');
  }
});

// Route handler for handling filter submissions
app.post('/filter', async (req, res) => {
  try {
      let query = "SELECT * FROM cars WHERE condition IN ('Foreign Used', 'Locally Used')";
      const { make, model, body } = req.body;
      const queryParams = [];

      if (make) {
          queryParams.push(make);
          query += " AND make = $1";
      }

      if (model) {
          queryParams.push(model);
          query += " AND model = $2";
      }

      if (body) {
          queryParams.push(body);
          query += " AND body = $3";
      }

      const { rows } = await pool.query(query, queryParams);

      const filteredDeals = rows.map((car) => {
          const mainImageBuffer = car.mainimage;
          const mainImageBase64 = mainImageBuffer ? `data:image/jpeg;base64,${mainImageBuffer.toString('base64')}` : null;
          return {
              ...car,
              mainImage: mainImageBase64,
              price: car.price,
              stock: car.stock,
              condition: car.condition,
              engineFuel: car.enginefuel,
              transmission: car.transmission,
              engineSize: car.enginesize,
              year: car.year,
              mileage: car.mileage,
              body: car.body,
              train: car.train
          };
      });

      res.render('used', { cars: filteredDeals });
  } catch (error) {
      console.error('Error executing query', error);
      res.status(500).send('Internal Server Error');
  }
});

app.post('/enquiry', async (req, res) => {
  try {
    const { carname, carid, year, firstname, lastname, email, contact, description } = req.body;

    // Get the current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split('T')[0];

    // Get the current time
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

    const client = await pool.connect();
    // Insert enquiry data into the car_enquiries table along with date and time
    const query = `
      INSERT INTO car_enquiries (carname, car_id, year, firstname, lastname, email, contact, description, date, time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    const values = [carname, carid, year, firstname, lastname, email, contact, description, currentDate, currentTime];

    await client.query(query, values);
    res.redirect('/');
    
  } catch (error) {
    console.error('Error handling enquiry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/available', async (req, res) => {
  try {
    const { carname, carid, year, firstname, lastname, email, contact } = req.body;

    // Default message for description
    const description = 'Is it still available for sale?';

    // Get the current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split('T')[0];

    // Get the current time
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

    const client = await pool.connect();
    // Insert enquiry data into the car_enquiries table along with date and time
    const query = `
      INSERT INTO car_enquiries (carname, car_id, year, firstname, lastname, email, contact, description, date, time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    const values = [carname, carid, year, firstname, lastname, email, contact, description, currentDate, currentTime];

    await client.query(query, values);

    res.redirect('/');

  } catch (error) {
    console.error('Error handling enquiry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/productidrepeat', async (req, res) => {
  const productId = req.query.carid;

 

  try {

  
    // Validate productId
    if (!Number.isInteger(parseInt(productId))) {
      console.log('Invalid product ID');
      return res.status(400).send('Invalid product ID');
    }

    // Increment the view count for the visited car in car_views table
    const updateQuery = 'INSERT INTO car_views (car_id, views) VALUES ($1, 1) ON CONFLICT (car_id) DO UPDATE SET views = car_views.views + 1';
    await pool.query(updateQuery, [productId]);

    


    const query = 'SELECT * FROM cars WHERE id = $1';
    const { rows } = await pool.query(query, [productId]);
    const car = rows[0];

    if (!car) {
      return res.status(404).send('Car not found');
    }

    // Get make of the current car
    const make = car.make;

    // Fetch similar cars with the same make
    const similarCarsQuery = 'SELECT * FROM cars WHERE make = $1 AND id != $2';
    const similarCarsResult = await pool.query(similarCarsQuery, [make, productId]);
    const similarCars = similarCarsResult.rows;

    // Clean data and convert comma-separated values to arrays
    const cleanData = {
      exterior: car.exterior.replace(/[\[\]"]+/g, ''),
      interior: car.interior.replace(/[\[\]"]+/g, ''),
      safety: car.safety.replace(/[\[\]"]+/g, ''),
    };

    const exteriorArray = cleanData.exterior.split(',').map(value => value.trim());
    const interiorArray = cleanData.interior.split(',').map(value => value.trim());
    const safetyArray = cleanData.safety.split(',').map(value => value.trim());
    
    // Map deals
    const images = rows.map((car) => {
      const mainImageBuffer = car.mainimage;
      const mainImageBase64 = mainImageBuffer ? `data:image/jpeg;base64,${Buffer.from(mainImageBuffer).toString('base64')}` : null;
      
      // Convert other images to base64
      const otherImagesBase64 = car.otherimages.map(imageBuffer => {
        return imageBuffer ? `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}` : null;
      });
      
      return { 
        ...car, 
        mainImage: mainImageBase64,
        otherImages: otherImagesBase64,
      };
    });


    const similarCarsWithImages = similarCars.map((similarCar) => {
      const mainImageBuffer = similarCar.mainimage;
      const mainImageBase64 = mainImageBuffer ? `data:image/jpeg;base64,${Buffer.from(mainImageBuffer).toString('base64')}` : null;
  
      // If mainImageBase64 is null or invalid, use the original mainImage from the database
      const mainImage = mainImageBase64 || similarCar.mainImage;
  
      // Convert other images to base64
      const otherImagesBase64 = similarCar.otherimages.map(imageBuffer => {
          return imageBuffer ? `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}` : null;
      });
  
      return { 
          ...similarCar, 
          mainImage: mainImage,
          otherImages: otherImagesBase64,
      };
  });
   

       
    // Render the product detail page passing the car details and similar cars
    res.render('productdetails', { cars: images , exteriorArray, interiorArray, safetyArray, similarCars: similarCarsWithImages  });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Internal Server Error');
  }
});



  
  


  

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
