'use strict'

try {
  require('dotenv').config({ silent: true })
} catch (e) {}

const path = require('path')
const express = require('express')
const favicon = require('serve-favicon')
const bodyParser = require('body-parser')
const serveStatic = require('serve-static')

const port = process.env.PORT || 5000

// Адаптер для подключения интеграции с внешней CRM
let CrmAdapter = require('onlinepbx-crm-adapter')

// Расширения для адаптера
const onlinepbxMoysklad = require('onlinepbx-moysklad') // Интеграция с МойСклад
const onlinepbxInfophon = require('onlinepbx-infophon') // Поиск номера телефона в безе infophon.ru
const onlinepbxTelegram = require('onlinepbx-telegram') // Telegram уведомления о входящих звонках

// Компановка адаптера с расширениями
CrmAdapter = CrmAdapter.compose(
  onlinepbxMoysklad,
  onlinepbxInfophon)

// Создаем Express сервер
let server = express()

// Подключаем общие middleware
server.use(serveStatic(path.resolve(__dirname, './public')))
server.use(favicon(path.resolve(__dirname, './public/favicon.ico')))
server.use(bodyParser.urlencoded({ extended: true }))

// Подключаем обработку запросов OnlinePBX через адаптер

// Создание экземпляра адаптера для обработки комманд аддона (синхронная инициализация)
let addonAdapter = CrmAdapter()
server.post('/addon', (req, res, next) => {
  addonAdapter.addonAction(req.body)
    .then(data => res.send(data))
    .catch(err => res.send({
      status: 0,
      comment: err.message
    }))
})

// Создание экземпляра адаптера для обработки http комманд
// - telegram модуль подключаем только для обработчика http комманд, чтобы уведомление не приходило
//   повторно в момент активации аддона, т.к. это совершенно независимые запросы
// - модуль onlinepbx-telegram требудет асинхронной инициализации
CrmAdapter.compose(onlinepbxTelegram).create({
  translitHttpSetNameCommand: true // Некторые трубки не отображают кириллицу
})
  .then(httpAdapter => {
    // Обработчик событий http-комманд
    server.post('/http', (req, res, next) => {
      httpAdapter.httpCommand(req.body)
        .then(data => res.send(data))
        .catch(err => res.status(500).send(err.message))
    })

    // Обработка общих ошибок
    server.use(function (err, req, res, next) {
      console.error(err.message)
      res.status(500).send(err.message)
    })

    server.listen(port, () => console.log('Server is running on port', port))
  })
  .catch(err => console.log(err))
