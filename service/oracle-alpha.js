const oracledb = require('oracledb')

const getConnection = () => {
  return new Promise((resolve, reject) => {
    oracledb
      .getConnection({
        user: process.env.ALPHA_USER,
        password: process.env.ALPHA_PASS,
        connectString: process.env.ALPHA_CONNECT_STRING
      })
      .then(connection => {
        resolve(connection)
      })
      .catch(err => {
        reject(err)
      })
  })
}

const getPool = () => {
  return new Promise((resolve, reject) => {
    oracledb
      .createPool({
        user: process.env.ALPHA_USER,
        password: process.env.ALPHA_PASS,
        connectString: process.env.ALPHA_CONNECT_STRING,
        poolMax: 40,
        poolMin: 4,
        poolIncrement: 5,
        poolTimeout: 4
      })
      .then(pool => {
        resolve(pool)
      })
      .catch(err => {
        reject(err)
      })
  })
}

module.exports = {
  getConnection,
  getPool
}
