#!/usr/bin/env node

const path = require('path');
// Correctly resolve the main script from the package's root
require(path.resolve(__dirname, '..', 'index.js'));
