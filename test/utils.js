const origraph = require('../dist/origraph.cjs.js');
const mime = require('mime-types');
const fs = require('fs');

const utils = {
  loadRawText: async function (filename) {
    return new Promise((resolve, reject) => {
      fs.readFile(`test/data/${filename}`, 'utf8', async (err, text) => {
        if (err) { reject(err); }
        resolve(text);
      });
    });
  },
  loadFiles: async function (filenames) {
    origraph.createModel();
    return Promise.all(filenames.map(async filename => {
      const text = await utils.loadRawText(filename);
      return origraph.currentModel.addTextFile({
        name: filename,
        format: mime.extension(mime.lookup(filename)),
        text: text
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
    for await (const sample of tableObj.iterate(5)) {
      samples.push(sample);
    }
    return samples;
  },
  setupSmallMovies: async function () {
    let [ people, movies, movieEdges ] = await utils.loadFiles([
      'movies/small/people.csv',
      'movies/small/movies.csv',
      'movies/small/movieEdges.csv'
    ]);

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
    });
    territoryRegion.setClassName('Territory Region');
    const customerOrders = customers.connectToNodeClass({
      otherNodeClass: orders,
      attribute: 'customerID',
      otherAttribute: 'customerID'
    });
    customerOrders.setClassName('Customer Orders');
    const orderEmployee = employees.connectToNodeClass({
      otherNodeClass: orders,
      attribute: 'employeeID',
      otherAttribute: 'employeeID'
    });
    orderEmployee.setClassName('Order Employee');
    const shippedVia = shippers.connectToNodeClass({
      otherNodeClass: orders,
      attribute: 'shipperID',
      otherAttribute: 'shipVia'
    });
    shippedVia.setClassName('Shipped Via');
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
    });
    productSupplier.setClassName('Product Supplier');
    const productCategory = products.connectToNodeClass({
      otherNodeClass: categories,
      attribute: 'categoryID',
      otherAttribute: 'categoryID'
    });
    productCategory.setClassName('Product Category');
    const supplierTerritory = suppliers.connectToNodeClass({
      otherNodeClass: territories,
      attribute: 'city',
      otherAttribute: 'territoryDescription'
    });
    supplierTerritory.setClassName('Supplier Territory');

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
  },
  setupBigMovies: async () => {
    const classes = await utils.loadFilesAsDict([
      'movies/big/movies.json',
      'movies/big/credits.json',
      'movies/big/people.json',
      'movies/big/companies.json'
    ]);

    let movies = classes['movies/big/movies.json'].interpretAsNodes();
    movies.setClassName('Movies');

    let [ cast, crew ] = classes['movies/big/credits.json']
      .closedTranspose(['cast', 'crew']);
    classes['movies/big/credits.json'].delete();

    cast = cast.interpretAsEdges();
    cast.setClassName('Cast');

    crew = crew.interpretAsEdges();
    crew.setClassName('Crew');

    let people = classes['movies/big/people.json'].interpretAsNodes();
    people.setClassName('People');

    let companies = classes['movies/big/companies.json'].interpretAsNodes();
    companies.setClassName('Companies');

    cast.connectToNodeClass({
      nodeClass: movies,
      side: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'movie_id'
    });
    cast.connectToNodeClass({
      nodeClass: people,
      side: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'id'
    });
    crew.connectToNodeClass({
      nodeClass: movies,
      side: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'movie_id'
    });
    crew.connectToNodeClass({
      nodeClass: people,
      side: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'id'
    });
    const companyLinks = companies.connectToNodeClass({
      otherNodeClass: movies,
      attribute: 'movie_id',
      otherAttribute: 'id'
    });
    companyLinks.setClassName('Company Links');

    return {
      movies,
      cast,
      crew,
      people,
      companies,
      companyLinks
    };
  }
};
module.exports = utils;
