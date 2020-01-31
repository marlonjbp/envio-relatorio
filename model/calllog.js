const moment = require('moment')

const arrayToList = (total, item, index, lista) => {
  if (index === 1) {
    total = `'${total}', `
  }

  if (index === lista.length - 1) {
    return total += `'${item}'`
  } else {
    return total += `'${item}', `
  }
}

const formatar = data => {
  const columns = data.metaData.map(item => item.name)
  data = data.rows.map(item => {
    const obj = {}

    item.map((info, index) => {
      obj[columns[index]] = info
      return obj
    })

    const start = moment(obj.INICIO, 'DD-MM-YYYY HH:mm:ss')
    const end = moment(obj.TERMINO, 'DD-MM-YYYY HH:mm:ss')
    const duracao = moment.duration(end.diff(start))
    obj.DURACAO = duracao.as('seconds')

    return obj
  })
  return data
}

const getDetalhesDiaChamadasDiscadas = (dominio, did, dia) => {
  return new Promise(async (resolve, reject) => {
    try {
      const conn = await require('../service/oracle-cloud').getConnection()

      const rows = await conn.execute(`
        select
            u.VCH_USERNAME as usuario,
            cl.VCH_DISPLAY as destino,
            cl.INT_CALLTYPE as tipo, -- 7 recebida, 6 discada
            cl.INT_STATUS as estado, -- 30 transferida, 25 conectada, 28 não respondido, 36 não existe
            cl.VCH_FORWARDEDADDRESS,
            TO_CHAR(cl.DTM_FROM_DATE,'DD-MM-YYYY HH24:MI:SS') as inicio,
            TO_CHAR(cl.DTM_UNTIL_DATE,'DD-MM-YYYY HH24:MI:SS') as termino,
            cl.VCH_MYADDRESS as DDR
        from
            BASIXBRASTEL.tbl_pbx_calllog cl,
            BASIXBRASTEL.tbl_pbx_pbxuser pu,
            BASIXBRASTEL.tbl_sys_user u,
            BASIXBRASTEL.tbl_sys_domain d
        where
            d.vch_domain = '${dominio}'
            and d.int_domain_key = u.int_domain_key
            and u.int_user_key = pu.int_user_key
            and cl.int_pbxuser_key = pu.int_pbxuser_key
            and cl.dtm_from_date BETWEEN TO_DATE('${dia} 00:00:00','DD-MM-YYYY HH24:MI:SS') and TO_DATE('${dia} 23:59:59','DD-MM-YYYY HH24:MI:SS')
            and cl.vch_myaddress = '${did}' and
            cl.int_calltype = 6
        order by
            cl.INT_CALLLOG_KEY
      `)
      conn.close()

      let result = formatar(rows)
      result = result.filter(item => item.DURACAO > 0)
      const segundos = result.reduce((total, item) => {
        return total += item.DURACAO
      }, 0)

      let total = moment.duration(segundos, 'seconds')
      total = `${total.get('hours').toString().padStart(2, '0')}:${total.get('minutes').toString().padStart(2, '0')}:${total.get('seconds').toString().padStart(2, '0')}`

      resolve({ [dia]: total })
    } catch (error) {
      reject(error)
    }
  })
}

const getCdr = ({ inicio, termino }) => {
  return new Promise(async (resolve, reject) => {
    try {
      const conn = await require('../service/oracle-cloud').getConnection()

      let { rows } = await conn.execute(`
        select
            distinct vch_callid
        from(
        select
            vch_callid
        from
            BASIXBRASTEL.tbl_pbx_systemcalllog
        where
            int_domain_key = 527 and
            vch_to in ('551135881620', '551140033087') and
            dtm_starttime BETWEEN TO_DATE('${inicio}', 'DD-MM-YYYY HH24:MI:SS') and
            TO_DATE('${termino}', 'DD-MM-YYYY HH24:MI:SS')
        order by
            dtm_starttime
        desc)
      `)

      rows = rows.map(item => item[0])
      const lista = []

      for (let i = 0; i < rows.length; i++) {
        const item = rows[i]

        const result = await conn.execute(`
          select
            int_connectionsequence,
            vch_from,
            vch_to,
            vch_target,
            vch_username,
            (((dtm_endtime) - (dtm_starttime)) * 24 * 60 * 60) as duracao,
            TO_CHAR(dtm_starttime,'DD-MM-YYYY HH24:MI:SS') as inicio,
            TO_CHAR(dtm_endtime,'DD-MM-YYYY HH24:MI:SS') as termino,
            int_status as status,
            --replace(int_status, 0, 'ESTABLISHED') as status,
            int_releasecause as desconexao
            -- replace(replace(replace(int_releasecause, 1, 'BYE (BYE)'), 6, 'TRANSFERED (BYE)'), 8 , 'NORMAL (BYE)') as desconexao
        from
            BASIXBRASTEL.tbl_pbx_systemcalllog
        where
            vch_callid = '${item}'
        order by
            int_connectionsequence
        `)

        lista[i] = result.rows
        console.log(`${i + 1} de ${rows.length}`)
      }

      conn.close()
      resolve(lista)
    } catch (error) {
      reject(error)
    }
  })
}

const getCdrFromDomain = (domain, dids, start, end) => {
  return new Promise(async (resolve, reject) => {
    try {
      const conn = await require('../service/oracle-cloud').getConnection()

      let { rows } = await conn.execute(`
        select
            distinct vch_callid
        from(
        select
            vch_callid
        from
          BASIXBRASTEL.tbl_pbx_systemcalllog cl,
          BASIXBRASTEL.tbl_sys_domain d
        where
          cl.int_domain_key = d.int_domain_key and
          d.vch_domain = '${domain}' and
            vch_to in (${dids.reduce(arrayToList)}) and
            dtm_starttime BETWEEN TO_DATE('${start}', 'DD-MM-YYYY HH24:MI:SS') and
            TO_DATE('${end}', 'DD-MM-YYYY HH24:MI:SS')
        order by
            dtm_starttime
        desc)
      `)

      rows = rows.map(item => item[0])
      const lista = []

      for (let i = 0; i < rows.length; i++) {
        const item = rows[i]

        const result = await conn.execute(`
          select
            int_connectionsequence,
            vch_from,
            vch_to,
            vch_target,
            vch_username,
            (((dtm_endtime) - (dtm_starttime)) * 24 * 60 * 60) as duracao,
            TO_CHAR(dtm_starttime,'DD-MM-YYYY HH24:MI:SS') as inicio,
            TO_CHAR(dtm_endtime,'DD-MM-YYYY HH24:MI:SS') as termino,
            int_status as status,
            --replace(int_status, 0, 'ESTABLISHED') as status,
            int_releasecause as desconexao
            -- replace(replace(replace(int_releasecause, 1, 'BYE (BYE)'), 6, 'TRANSFERED (BYE)'), 8 , 'NORMAL (BYE)') as desconexao
        from
            BASIXBRASTEL.tbl_pbx_systemcalllog
        where
            vch_callid = '${item}'
        order by
            int_connectionsequence
        `)

        lista[i] = result.rows
        console.log(`${i + 1} de ${rows.length}`)
      }

      conn.close()
      resolve(lista)
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  getCdr,
  getCdrFromDomain,
  arrayToList,
  getDetalhesDiaChamadasDiscadas
}
