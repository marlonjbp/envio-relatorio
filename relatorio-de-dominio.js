require('dotenv').config()
const xlsx = require('xlsx')
const User = require('./model/User')
const DIDs = require('./model/Dids')
const Groups = require('./model/Groups')

const executar = async () => {
  const usuarios = await User.getUsersFromDomain({ domain: 'ccastilho.brastel.com.br' })
    .catch(error => {
      console.log(error)
    })

  const terminais = await User.getTerminaisFromDomain({ domain: 'ccastilho.brastel.com.br' })
    .catch(error => {
      console.log(error)
    })

  const dids = await DIDs.getDidsFromDomain({ domain: 'ccastilho.brastel.com.br' })
    .catch(error => {
      console.log(error)
    })

  const grupos = await Groups.getGroupsFromDomain({ domain: 'ccastilho.brastel.com.br' })
    .catch(error => {
      console.log(error)
    })

  const ws1 = xlsx.utils.json_to_sheet(usuarios)
  const ws2 = xlsx.utils.json_to_sheet(terminais)
  const ws3 = xlsx.utils.json_to_sheet(dids)
  const ws4 = xlsx.utils.json_to_sheet(grupos)

  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws1, 'Relação de Ramais')
  xlsx.utils.book_append_sheet(wb, ws2, 'Relação de Terminais')
  xlsx.utils.book_append_sheet(wb, ws3, 'Relação de Numeros')
  xlsx.utils.book_append_sheet(wb, ws4, 'Grupos')

  xlsx.writeFile(wb, './configuração center castilho.xlsx')
}

executar()
