#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var colors = require('ansi-256-colors');

var appDirectory = {};
fs.readdir(path.join(__dirname, '../../apps'), function (err, appNames) {
  if (err) {
    console.log('Error scanning sub apps (this script only works when' +
                'mure-library is installed as a submodule of the main site):', err);
    process.exit();
  }
  appNames.forEach(function (appName) {
    // Validate that both package.json and webpack.config.js exist
    try {
      var packageJson = require(path.join(__dirname, '../../apps/' + appName + '/package.json'));
      var subConfig = require(path.join(__dirname, '../../apps/' + appName + '/webpack.config.js'));

      // Add an entry
      appDirectory[appName] = {
        name: appName,
        description: packageJson.description || '',
        author: packageJson.author || ''
      };
      console.log(colors.fg.getRgb(1, 3, 2) + appName + ' app added successfully!' + colors.reset);
    } catch (ex) {
      console.log(colors.fg.getRgb(5, 1, 3) + 'Error loading ' + appName + ':\n' + ex.message + colors.reset);
    }
  });

  // Finally, write the directory of apps to a json file
  fs.writeFile('../src/appList.json', JSON.stringify(appDirectory, null, 2));
});
