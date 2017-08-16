#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var colors = require('ansi-256-colors');

var logColor = colors.fg.getRgb(1, 3, 2);
var errorColor = colors.fg.getRgb(5, 1, 3);

fs.readdir(path.join(__dirname, '../../apps'), function (err, appNames) {
  var appDirectory = {};
  var appPromises = [];

  if (err) {
    console.log('Error scanning sub apps (this script only works when' +
                'mure-library is installed as a submodule of the main site):', err);
    process.exit();
  }

  appNames.forEach(function (appName) {
    appPromises.push(new Promise(function (resolve, reject) {
      // Validate that both package.json and webpack.config.js exist
      try {
        var packageJson = require(path.join(__dirname, '../../apps/' + appName + '/package.json'));
        fs.readFile(path.join(__dirname, '../../apps/' + appName + '/img/app.svg'),
          function (err, imageData) {
            if (err) {
              console.log(errorColor + 'Error loading icon for ' + appName + ':' + colors.reset);
              console.log(err.message);
            } else {
              // Add an entry
              appDirectory[appName] = {
                name: appName,
                description: packageJson.description || '',
                author: packageJson.author || '',
                icon: imageData.toString('base64')
              };
              console.log(logColor + appName + ' app added successfully!' + colors.reset);
            }
            resolve();
          });
      } catch (err) {
        console.log(errorColor + 'Error loading ' + appName + ':' + colors.reset);
        console.log(err.message);
        resolve();
      }
    }));
  });

  // Finally, write the directory of apps to a json file
  Promise.all(appPromises).then(function () {
    fs.writeFile('../src/appList.json', JSON.stringify(appDirectory, null, 2));
  });
});
