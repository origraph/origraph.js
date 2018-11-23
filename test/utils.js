const origraph = require('../dist/origraph.cjs.js');
const mime = require('mime-types');
const fs = require('fs');

const utils = {
  loadFiles: async function (filenames) {
    origraph.createModel();
    return Promise.all(filenames.map(async filename => {
      return new Promise((resolve, reject) => {
        fs.readFile(`test/data/${filename}`, 'utf8', async (err, text) => {
          if (err) { reject(err); }
          resolve(await origraph.currentModel.addStringAsStaticTable({
            name: filename,
            extension: mime.extension(mime.lookup(filename)),
            text
          }));
        });
      });
    }));
  },
  loadFilesAsDict: async function (filenames) {
    const classes = {};
    const rawClasses = await utils.loadFiles(filenames);
    filenames.forEach((filename, index) => {
      classes[filename] = rawClasses[index];
    });
    return classes;
  },
  async getFiveSamples (tableObj) {
    const samples = [];
    for await (const sample of tableObj.iterate({ limit: 5 })) {
      samples.push(sample);
    }
    return samples;
  },
  setupMovies: async function () {
    let [ people, movies, movieEdges ] = await utils.loadFiles(['people.csv', 'movies.csv', 'movieEdges.csv']);

    // Initial interpretation
    people = people.interpretAsNodes();
    people.setClassName('People');

    movies = movies.interpretAsNodes();
    movies.setClassName('Movies');

    movieEdges = movieEdges.interpretAsEdges();
    movieEdges.setClassName('Movie Edges');

    // Set up initial connections
    people.connectToEdgeClass({
      edgeClass: movieEdges,
      side: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'personID'
    });
    movieEdges.connectToNodeClass({
      nodeClass: movies,
      side: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'movieID'
    });

    return { people, movies, movieEdges };
  },
  setupNorthwind: async function () {
    const classes = await utils.loadFilesAsDict([
      'northwind/categories.csv',
      'northwind/customers.csv',
      'northwind/employees.csv',
      'northwind/employee_territories.csv',
      'northwind/order_details.csv',
      'northwind/orders.csv',
      'northwind/products.csv',
      'northwind/regions.csv',
      'northwind/shippers.csv',
      'northwind/suppliers.csv',
      'northwind/territories.csv'
    ]);

    let employees = classes['northwind/employees.csv'].interpretAsNodes();
    employees.setClassName('Employees');

    let territories = classes['northwind/territories.csv'].interpretAsNodes();
    territories.setClassName('Territory');

    let employeeTerritories = classes['northwind/employee_territories.csv'].interpretAsEdges();
    employeeTerritories.setClassName('Employee Territory');

    let regions = classes['northwind/regions.csv'].interpretAsNodes();
    regions.setClassName('Regions');

    let customers = classes['northwind/customers.csv'].interpretAsNodes();
    customers.setClassName('Customers');

    let orders = classes['northwind/orders.csv'].interpretAsNodes();
    orders.setClassName('Orders');

    let orderDetails = classes['northwind/order_details.csv'].interpretAsEdges();
    orderDetails.setClassName('Order Details');

    let shippers = classes['northwind/shippers.csv'].interpretAsNodes();
    shippers.setClassName('Shippers');

    let products = classes['northwind/products.csv'].interpretAsNodes();
    products.setClassName('Products');

    let suppliers = classes['northwind/suppliers.csv'].interpretAsNodes();
    suppliers.setClassName('Suppliers');

    let categories = classes['northwind/categories.csv'].interpretAsNodes();
    categories.setClassName('Categories');

    employees.connectToEdgeClass({
      edgeClass: employeeTerritories,
      side: 'source',
      nodeAttribute: 'employeeID',
      edgeAttribute: 'employeeID'
    });
    territories.connectToEdgeClass({
      edgeClass: employeeTerritories,
      side: 'target',
      nodeAttribute: 'territoryID',
      edgeAttribute: 'territoryID'
    });
    const territoryRegion = regions.connectToNodeClass({
      otherNodeClass: territories,
      attribute: 'regionID',
      otherAttribute: 'regionID'
    }).setClassName('Territory Region');
    const customerOrders = customers.connectToNodeClass({
      otherNodeClass: orders,
      attribute: 'customerID',
      otherAttribute: 'customerID'
    }).setClassName('Customer Orders');
    const orderEmployee = employees.connectToNodeClass({
      otherNodeClass: orders,
      attribute: 'employeeID',
      otherAttribute: 'employeeID'
    }).setClassName('Order Employee');
    const shippedVia = shippers.connectToNodeClass({
      otherNodeClass: orders,
      attribute: 'shipperID',
      otherAttribute: 'shipVia'
    }).setClassName('Shipped Via');
    orderDetails.connectToNodeClass({
      nodeClass: orders,
      side: 'source',
      nodeAttribute: 'orderID',
      edgeAttribute: 'orderID'
    });
    orderDetails.connectToNodeClass({
      nodeClass: products,
      side: 'target',
      nodeAttribute: 'productID',
      edgeAttribute: 'productID'
    });
    const productSupplier = products.connectToNodeClass({
      otherNodeClass: suppliers,
      attribute: 'supplierID',
      otherAttribute: 'supplierID'
    }).setClassName('Product Supplier');
    const productCategory = products.connectToNodeClass({
      otherNodeClass: categories,
      attribute: 'categoryID',
      otherAttribute: 'categoryID'
    }).setClassName('Product Category');
    const supplierTerritory = suppliers.connectToNodeClass({
      otherNodeClass: territories,
      attribute: 'city',
      otherAttribute: 'territoryDescription'
    }).setClassName('Supplier Territory');

    return {
      categories,
      customers,
      employees,
      employeeTerritories,
      orderDetails,
      orders,
      products,
      regions,
      shippers,
      suppliers,
      territories,
      territoryRegion,
      customerOrders,
      orderEmployee,
      shippedVia,
      productSupplier,
      productCategory,
      supplierTerritory
    };
  }
};
module.exports = utils;
