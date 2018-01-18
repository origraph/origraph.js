mure.js
=======
[![Build Status](https://travis-ci.org/mure-apps/mure-library.svg?branch=master)](https://travis-ci.org/mure-apps/mure-library)

An integration library for the mure ecosystem of apps

Currently in development; ultimately, this will be a library that people can use
to create their own mure applications. It will handle syncing changes to any other
open mure apps... though probably third-party apps not hosted under the mure-apps
github organization will need to sync first with a third-party couchdb instance
somewhere because of cross-domain issues.

It will also become the vehicle through which metadata is discovered, read, and
written. Additionally, as specific types of metadata become more standardized
across apps, some core functionality associated with that metadata may be
absorbed here as well.
