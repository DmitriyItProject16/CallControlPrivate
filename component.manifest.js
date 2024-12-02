module.exports = {
  vendorName: 'Directum',
  componentName: 'ReactExample',
  componentVersion: '1.0',
  // Описание контролов, которые есть в компоненте. Реализация контролов находится в папке ./src/controls.
  controls: [
    {
      name: 'CallControl',
      loaders: [
        {
          name: 'call-control-loader',
          scope: 'Card'
        }
      ],
      displayNames: [
        { locale: 'en', name: 'Call control' },
        { locale: 'ru', name: 'Контрол звонка' },
      ]
    }
  ]
};
