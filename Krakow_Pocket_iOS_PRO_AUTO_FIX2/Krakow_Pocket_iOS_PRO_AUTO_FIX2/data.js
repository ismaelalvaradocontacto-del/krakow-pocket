window.KP_DATA = {
  version: "3.0.0",
  trip: {
    title: "Kraków Pocket", subtitle: "La búsqueda de las Escamas de Wawel",
    start: "2026-08-11T10:15:00+02:00", end: "2026-08-13T20:00:00+02:00",
    outbound: "2026-08-11T06:00:00+02:00", stationTarget: "2026-08-11T05:30:00+02:00",
    returnDepart: "2026-08-13T20:00:00+02:00", returnArrive: "2026-08-14T00:10:00+02:00",
    dailyTarget: 21, fixedPaid: 72.16,
    baseWarsaw: "Stalowa 20/22, 03-426 Warszawa, Poland",
    stationWarsaw: "Warszawa Zachodnia Bus Station, Warsaw, Poland",
    stationKrakow: "Kraków MDA Bus Station, Bosacka 18, Kraków, Poland"
  },
  days: [
    {date:"2026-08-11",short:"Mar 11",title:"Primer contacto",plan:"10:15 llegada · Old Town · Wawel",districts:["old","wawel"],note:"Llegar, dejar cosas, leer la ciudad andando y no intentar verlo todo el primer día."},
    {date:"2026-08-12",short:"Mié 12",title:"Kazimierz + Podgórze",plan:"Kazimierz · Vístula · Podgórze",districts:["kazimierz","podgorze"],note:"Día de barrios, historia y paseo. Mejor pocas paradas con contexto que una lista interminable."},
    {date:"2026-08-13",short:"Jue 13",title:"Día flexible",plan:"Pendientes · descanso · 20:00 bus",districts:["old","kazimierz","podgorze"],note:"Guardad margen. Desde las 18:30 la app prioriza acercaros a Kraków MDA."}
  ],
  categories: {
    history:{label:"Historia",emoji:"🏛️"}, game:{label:"Aventura",emoji:"🐉"}, walk:{label:"Paseo",emoji:"🌉"},
    food:{label:"Comer",emoji:"🍲"}, shop:{label:"Comprar",emoji:"🛒"}, museum:{label:"Museo",emoji:"🎟️"},
    rest:{label:"Descanso",emoji:"🌿"}, base:{label:"Base",emoji:"🏠"}, bus:{label:"Transporte",emoji:"🚌"}
  },
  expenseCategories: {supermarket:"🛒 Súper",food:"🍲 Comida",transport:"🚋 Transporte",coffee:"☕ Café/snack",activity:"🎟️ Actividad",other:"🧾 Otros"},
  pois: [
    {id:"mda",name:"Kraków MDA",category:"bus",district:"old",days:[1,3],emoji:"🚌",lat:50.0673,lon:19.9450,mapsQuery:"Kraków MDA, Bosacka 18, Kraków",cost:"pagado",costLevel:0,duration:15,story:"Vuestra puerta de entrada y salida de Cracovia. Al final del viaje la prioridad deja de ser descubrir y pasa a ser llegar aquí sin correr."},
    {id:"w94",name:"W94 Hostel",category:"base",district:"old",days:[1,2,3],emoji:"🏠",lat:50.0649,lon:19.9345,mapsQuery:"Juliana Dunajewskiego 8, Kraków",cost:"pagado",costLevel:0,duration:15,story:"Vuestra base en Cracovia. Planty funciona como un corredor peatonal muy cómodo para entrar y salir del casco histórico."},
    {id:"florian",name:"Puerta de San Florián",category:"history",district:"old",days:[1],emoji:"🛡️",lat:50.0647,lon:19.9414,mapsQuery:"St. Florian's Gate, Kraków",cost:"gratis",costLevel:0,duration:20,story:"Una de las entradas históricas a la ciudad amurallada. Mirad la dirección de la calle Floriańska: la estructura medieval de Cracovia se entiende muy bien caminando desde aquí hacia Rynek."},
    {id:"rynek",name:"Rynek Główny",category:"history",district:"old",days:[1,3],emoji:"🏛️",lat:50.0617,lon:19.9373,mapsQuery:"Rynek Główny, Kraków",cost:"gratis",costLevel:0,duration:30,story:"El corazón de la Cracovia medieval. El mercado y la gran plaza muestran hasta qué punto comercio, poder y vida cotidiana compartían el mismo espacio."},
    {id:"maria",name:"Basílica de Santa María",category:"history",district:"old",days:[1,3],emoji:"🎺",lat:50.0617,lon:19.9393,mapsQuery:"St. Mary's Basilica, Kraków",cost:"exterior gratis",costLevel:0,duration:20,story:"Al cambio de hora podéis escuchar el hejnał desde la torre. La melodía termina bruscamente y es una de las tradiciones más reconocibles de la ciudad."},
    {id:"maius",name:"Collegium Maius",category:"history",district:"old",days:[1,3],emoji:"📚",lat:50.0619,lon:19.9333,mapsQuery:"Collegium Maius, Kraków",cost:"patio gratis",costLevel:0,duration:25,story:"Un rincón histórico de la Universidad Jaguelónica. El patio es una buena pausa de pocos minutos cuando el centro está lleno."},
    {id:"planty",name:"Planty",category:"rest",district:"old",days:[1,2,3],emoji:"🌿",lat:50.0627,lon:19.9360,mapsQuery:"Planty, Kraków",cost:"gratis",costLevel:0,duration:25,story:"El parque rodea el casco antiguo siguiendo en buena parte el trazado de las antiguas fortificaciones. También es vuestro mejor botón de pausa: sombra, bancos y un camino fácil de abandonar."},
    {id:"wawel",name:"Colina de Wawel",category:"history",district:"wawel",days:[1,3],emoji:"👑",lat:50.0540,lon:19.9355,mapsQuery:"Wawel Royal Castle, Kraków",cost:"exteriores gratis",costLevel:0,duration:60,story:"Wawel fue durante siglos un centro político y religioso fundamental de Polonia. Antes de comprar entradas podéis explorar la colina y entender su posición sobre el Vístula."},
    {id:"dragon",name:"Dragón de Wawel",category:"game",district:"wawel",days:[1,3],emoji:"🐉",lat:50.0529,lon:19.9334,mapsQuery:"Wawel Dragon, Kraków",cost:"gratis",costLevel:0,duration:20,story:"El dragón es el hilo conductor de vuestra aventura. Esta parada es el punto perfecto para convertir una leyenda de la ciudad en un recuerdo vuestro."},
    {id:"szeroka",name:"Calle Szeroka",category:"history",district:"kazimierz",days:[2],emoji:"✡️",lat:50.0522,lon:19.9473,mapsQuery:"Szeroka Street, Kraków",cost:"gratis",costLevel:0,duration:40,story:"Kazimierz fue durante siglos un centro de vida judía. En Szeroka merece más la pena observar fachadas, sinagogas, placas y patios que ir tachando puntos de una lista."},
    {id:"placnowy",name:"Plac Nowy",category:"food",district:"kazimierz",days:[2,3],emoji:"🥯",lat:50.0511,lon:19.9447,mapsQuery:"Plac Nowy, Kraków",cost:"barato",costLevel:1,duration:30,story:"Un punto muy práctico para sentir el Kazimierz contemporáneo y comparar precios antes de sentaros a comer."},
    {id:"bernatek",name:"Puente Bernatek",category:"walk",district:"kazimierz",days:[2],emoji:"🌉",lat:50.0465,lon:19.9475,mapsQuery:"Father Bernatek Footbridge, Kraków",cost:"gratis",costLevel:0,duration:20,story:"Cruzar este puente andando hace que el cambio entre Kazimierz y Podgórze se sienta físicamente. Es una transición natural y gratuita entre dos partes muy distintas de la ciudad."},
    {id:"ghetto",name:"Plac Bohaterów Getta",category:"history",district:"podgorze",days:[2],emoji:"🪑",lat:50.0466,lon:19.9548,mapsQuery:"Plac Bohaterów Getta, Kraków",cost:"gratis",costLevel:0,duration:30,story:"El memorial de las sillas recuerda a las personas confinadas y deportadas desde el gueto de Cracovia. Es una parada para bajar el ritmo y mirar el espacio antes de seguir."},
    {id:"podmuseum",name:"Museo de Podgórze",category:"museum",district:"podgorze",days:[2,3],emoji:"🏛️",lat:null,lon:null,mapsQuery:"Muzeum Podgórza, Limanowskiego 51, Kraków",cost:"comprobar tarifa",costLevel:2,duration:75,story:"Una opción para profundizar en la historia del distrito. La app evita dar por hecho horarios o gratuidades: comprobad la información del día antes de desplazaros."},
    {id:"tomasza",name:"Milkbar Tomasza",category:"food",district:"old",days:[1,3],emoji:"🍲",lat:50.0628,lon:19.9417,mapsQuery:"Milkbar Tomasza, Świętego Tomasza 24, Kraków",cost:"barato",costLevel:1,duration:45,story:"Una opción sencilla para una comida caliente en la zona centro. Mirad el menú y el precio real del día antes de decidir."},
    {id:"temida",name:"Bar Mleczny Pod Temidą",category:"food",district:"old",days:[1,3],emoji:"🥟",lat:50.0572,lon:19.9383,mapsQuery:"Bar Mleczny Pod Temidą, Grodzka 43, Kraków",cost:"barato",costLevel:1,duration:45,story:"Bien colocado si bajáis por Grodzka hacia Wawel. Es especialmente útil cuando queréis comer sin desviar la ruta."},
    {id:"sham",name:"SHAM Falafel",category:"food",district:"old",days:[1,3],emoji:"🧆",lat:50.0656,lon:19.9401,mapsQuery:"SHAM Falafel, Rynek Kleparski 5, Kraków",cost:"barato",costLevel:1,duration:40,story:"Alternativa rápida cerca del norte del casco antiguo cuando queráis algo sencillo y no necesariamente polaco."},
    {id:"biedronka",name:"Supermercado útil",category:"shop",district:"old",days:[1,2,3],emoji:"🛒",lat:null,lon:null,mapsQuery:"Biedronka near Kraków Old Town",cost:"ahorro",costLevel:0,duration:20,story:"Agua, desayuno, fruta, yogures o una cena sencilla: comprar de camino puede ahorrar dinero sin convertir el viaje en una competición por gastar menos."}
  ],
  quests: [
    {id:"q-florian",poi:"florian",title:"La puerta de los viajeros",text:"Entrad por San Florián y decidid juntos qué detalle os hace sentir que habéis llegado a otra ciudad.",points:10},
    {id:"q-rynek",poi:"rynek",title:"La mirada compartida",text:"Cada uno elige un detalle de Rynek que crea que el otro no ha visto todavía. Enseñáoslo sin señalarlo de inmediato.",points:15},
    {id:"q-maria",poi:"maria",title:"El trompetista invisible",text:"Escuchad el hejnał al cambio de hora e intentad localizar la torre sin mirar el móvil.",points:20},
    {id:"q-maius",poi:"maius",title:"El patio escondido",text:"Encontrad un detalle del Collegium Maius que merezca recordar aunque no salga en ninguna lista de imprescindibles.",points:10},
    {id:"q-wawel",poi:"wawel",title:"La colina de los reyes",text:"Encontrad una vista del Vístula que merezca una foto conjunta sin comprar ninguna entrada.",points:15},
    {id:"q-dragon",poi:"dragon",title:"La primera escama",text:"Encontrad al Dragón de Wawel y quedaos al menos un minuto sin hacer nada más que observar el lugar.",points:25},
    {id:"q-szeroka",poi:"szeroka",title:"Capas de Kazimierz",text:"Buscad tres señales distintas de la historia judía de Szeroka y comentad qué os cuentan del barrio.",points:20},
    {id:"q-placnowy",poi:"placnowy",title:"El cazador de gangas",text:"Comparad al menos dos precios antes de comprar un snack o sentaros a comer.",points:10},
    {id:"q-bernatek",poi:"bernatek",title:"Cruzar de mundo",text:"A mitad del puente, cada uno dice qué barrio le ha sorprendido más hasta ese momento y por qué.",points:10},
    {id:"q-ghetto",poi:"ghetto",title:"Las sillas",text:"Contad en silencio diez sillas del memorial antes de sacar el móvil o hacer una foto.",points:25},
    {id:"q-cheapmeal",poi:"tomasza",title:"Maestros del złoty",text:"Haced una comida caliente intentando que el gasto conjunto del día siga dentro de vuestro objetivo acumulado.",points:20},
    {id:"q-planty",poi:"planty",title:"Saber parar",text:"Sentaos diez minutos en Planty sin planificar la siguiente parada. La misión es descansar a tiempo.",points:15}
  ]
};
