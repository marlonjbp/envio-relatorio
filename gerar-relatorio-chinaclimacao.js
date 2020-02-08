require('dotenv').config()
const calllog = require('./model/calllog')
const xlsx = require('xlsx')

const executar = async () => {
  const result = await calllog.getCdrFromDomain(
    'chinaclimacao.brastel.com.br',
    [
      '551132030350',
      '551133413111',
      '551135800080',
      '551135881707',
      '551150628676',
      '551155731400',
      '551155753589'
    ],
    '07-02-2020 00:00:00',
    '07-02-2020 23:59:59'
  )

  const ws1 = xlsx.utils.json_to_sheet(result[0])
  const ws2 = xlsx.utils.json_to_sheet(result[1])

  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws2, 'Totais')
  xlsx.utils.book_append_sheet(wb, ws1, 'Chamadas')

  xlsx.writeFile(wb, './relatorio-china-aclimação.xlsx')
}

executar()
