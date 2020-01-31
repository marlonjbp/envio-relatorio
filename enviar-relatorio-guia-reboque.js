require('dotenv').config()
const calllog = require('./model/calllog')
const { enviarEmail } = require('./service/mail')
const Moment = require('moment')
const xlsx = require('xlsx')
Moment.locale('pt-BR')

const DidGuiaReboque = [
  '551131981646',
  '551131981647',
  '551131981648',
  '551135884759',
  '551135884760',
  '551135884761',
  '552139008858',
  '552139008859',
  '552139009973',
  '553135008208'
]

const executeGuia = async () => {
  const planilha = []
  const totais = []

  const x = new Moment()
  x.subtract(1, 'day')

  const result = await calllog.getCdrFromDomain(
    'guialitoral.brastel.com.br',
    DidGuiaReboque,
    `${x.format('DD-MM-YYYY')} 00:00:00`,
    `${x.format('DD-MM-YYYY')} 23:59:59`
  )

  let quantidadeAtendida = 0
  let quantidadeNAtendida = 0

  for (let i = 0; i < result.length; i++) {
    let item = result[i]

    let originador = ''
    let destino = ''
    let desligadoPor = ''
    let atendida = ''
    let inicio = ''
    let termino = ''
    let ligacaoAtendida = 'SIM'

    originador = item[0][1]
    destino = item[0][2]

    if (/^sip:(.*)@(.*)$/.test(originador)) {
      originador = originador.match(/^sip:(.*)@(.*)$/)[1]
    }

    if (/^sip:(.*)@(.*)$/.test(destino)) {
      destino = destino.match(/^sip:(.*)@(.*)$/)[1]
    }

    inicio = item[0][6]
    termino = item[0][7]

    item = item.map(item => {
      if (item[8] === 0) {
        item[8] = 'ESTABLISHED'
      }
      if (item[8] === 3) {
        item[8] = 'UNANSWERED'
      }
      if (item[8] === 8) {
        item[8] = 'CANCELED'
      }

      if (item[9] === 1) {
        item[9] = 'BYE (BYE)'
      }
      if (item[9] === 2) {
        item[9] = 'CANCELED (CANCELED)'
      }
      if (item[9] === 6) {
        item[9] = 'TRANSFERED (BYE)'
      }
      if (item[9] === 8) {
        item[9] = 'NORMAL (BYE)'
      }
      if (item[9] === 408) {
        item[9] = 'TIMEOUT (CANCELED)'
      }
      if (item[9] === 481) {
        item[9] = 'Call/Transaction Does Not Exist'
      }
      if (item[9] === 500) {
        item[9] = 'SERVER INTERNAL ERROR (SERVER INTERNAL ERROR)'
      }

      return item
    })

    atendida = item.filter(item => {
      if (item[8] === 'ESTABLISHED' && item[2].indexOf('usu') !== -1) {
        return item
      }
    }).map(item => item[2]).reduce((retorno, item, index, lista) => {
      if (index === 0) {
        return retorno = `${item} `
      }
      if (index === lista.length - 1) {
        return retorno += `${item}`
      }
      return retorno += `${item} `
    }, '')

    if (!atendida) {
      ligacaoAtendida = 'Não'
    }

    const desligada = item.filter(item => {
      if (item[9] === 'BYE (BYE)') {
        return item
      }
    })

    if (desligada.length === 0) {
      desligadoPor = 'Não identificado'
    } else {
      if (desligada[0][4] === 'gateway@centrex.brastel.com.br') {
        desligadoPor = 'Desligado Pelo Originador'
      }
    }

    if (!desligadoPor) {
      desligadoPor = desligada[desligada.length - 1][2]
    }

    if (ligacaoAtendida === 'SIM') {
      quantidadeAtendida++
    } else {
      quantidadeNAtendida++
    }

    planilha.push({
      Originador: originador,
      Destino: destino,
      Inicio: inicio,
      Termino: termino,
      DesligadoPor: desligadoPor,
      Status: atendida,
      Atendida: ligacaoAtendida
    })
  }
  totais.push({
    Atendidas: quantidadeAtendida,
    'Não Atendidas': quantidadeNAtendida
  })

  const ws1 = xlsx.utils.json_to_sheet(planilha)
  const ws2 = xlsx.utils.json_to_sheet(totais)

  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws2, 'Totais')
  xlsx.utils.book_append_sheet(wb, ws1, 'Chamadas')

  xlsx.writeFile(wb, './relatorio-guialitoral-reboque.xlsx')

  const corpo = `<p>Bom dia,<p>
    <p>Segue em anexo relatório diario das chamadas recebidas da Reboque.me.<p>
    <p>Atenciosamente<p>
    <p>Suporte Basix<p>`

  enviarEmail(
    'samuel.freire@reboque.me, evanildo.freire@reboque.me, suporte.basix@cloudcom.com.br',
    'Relatório de chamadas - Reboque.me - GuiaLitoral',
    corpo,
    'relatorio-guialitoral-reboque.xlsx'
  )
}

executeGuia()
