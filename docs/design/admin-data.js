window.ADMIN_DATA = {
  users: [
    {id:'u1',name:'Ola Nordmann',email:'ola@example.no',status:'aktiv',created:'2026-03-02',last:'I dag 09:14',cellars:['c1'],bottles:19,scans:142},
    {id:'u2',name:'Kari Nordmann',email:'kari@example.no',status:'aktiv',created:'2026-03-04',last:'I går 21:40',cellars:['c1'],bottles:19,scans:61},
    {id:'u3',name:'Per Hansen',email:'per.hansen@example.no',status:'aktiv',created:'2026-04-18',last:'22. sep',cellars:['c2'],bottles:47,scans:208},
    {id:'u4',name:'Ingrid Berg',email:'ingrid@example.no',status:'invitert',created:'2026-09-24',last:'—',cellars:[],bottles:0,scans:0},
    {id:'u5',name:'Lars Moe',email:'lars.moe@example.no',status:'deaktivert',created:'2026-05-10',last:'3. jul',cellars:['c3'],bottles:8,scans:22},
    {id:'u6',name:'Sofie Lie',email:'sofie@example.no',status:'aktiv',created:'2026-06-01',last:'19. sep',cellars:['c4'],bottles:31,scans:97}
  ],
  cellars: [
    {id:'c1',name:'Hjemme',owner:'u1',members:['u1','u2'],bottles:19,wines:7,value:9642,updated:'I dag 09:14',
     items:[{nr:'1670901',name:'Brezza Barolo Cannubi',qty:3},{nr:'8354901',name:'S. Billaud Chablis Les Vaillons VV',qty:2},{nr:'3761801',name:'Charles Heidsieck Brut Réserve',qty:4},{nr:'563301',name:'Rioja Alta Gran Reserva 904',qty:2},{nr:'315201',name:'Dr. Loosen Wehlener Sonnenuhr Kab',qty:3},{nr:'191401',name:'Dom. du Pegau Chateauneuf du Pape Res',qty:1},{nr:'2210601',name:"Caves d'Esclans Whispering Angel",qty:2}]},
    {id:'c2',name:'Kjelleren',owner:'u3',members:['u3'],bottles:47,wines:21,value:28310,updated:'22. sep',
     items:[{nr:'1616601',name:'Paolo Scavino Barolo Cannubi',qty:6},{nr:'4124601',name:'Marchesi di Barolo Barolo Cannubi',qty:4},{nr:'2032601',name:'Charles Heidsieck Brut Vintage',qty:3}]},
    {id:'c3',name:'Hytta',owner:'u5',members:['u5'],bottles:8,wines:4,value:2980,updated:'3. jul',
     items:[{nr:'2210601',name:"Caves d'Esclans Whispering Angel",qty:6},{nr:'334301',name:'Piper-Heidsieck Brut',qty:2}]},
    {id:'c4',name:'Vinskapet',owner:'u6',members:['u6'],bottles:31,wines:12,value:14870,updated:'19. sep',
     items:[{nr:'4469601',name:'Louis Moreau Chablis 1er Cru Vaillons',qty:6},{nr:'1386101',name:'Prüm Wehlener Sonnenuhr Riesling Ausl',qty:2}]}
  ],
  eans: [
    {ean:'8002235013826',nr:'1670901',name:'Brezza Barolo Cannubi',by:'u1',date:'28. aug',hits:4,flag:false},
    {ean:'3185370000335',nr:'3761801',name:'Charles Heidsieck Brut Réserve',by:'u1',date:'28. aug',hits:6,flag:false},
    {ean:'8410415520018',nr:'563301',name:'Rioja Alta Gran Reserva 904',by:'u3',date:'12. jun',hits:3,flag:false},
    {ean:'3760062190017',nr:'8354901',name:'S. Billaud Chablis Les Vaillons VV',by:'u6',date:'2. sep',hits:2,flag:true,note:'Samme strekkode registrert på 2 ulike viner'},
    {ean:'3760062190017',nr:'4469601',name:'Louis Moreau Chablis 1er Cru Vaillons',by:'u6',date:'19. sep',hits:1,flag:true,note:'Samme strekkode registrert på 2 ulike viner'},
    {ean:'3700000123456',nr:'2210601',name:"Caves d'Esclans Whispering Angel",by:'u5',date:'1. jul',hits:9,flag:false}
  ],
  dupes: [
    {id:'d1',a:{nr:'3761801',name:'Charles Heidsieck Brut Réserve',cellars:2,bottles:4},b:{nr:null,name:'Heidsieck Brut Reserve (manuell)',cellars:1,bottles:2},reason:'Likt navn · én uten varenummer'},
    {id:'d2',a:{nr:'1670901',name:'Brezza Barolo Cannubi',cellars:1,bottles:3},b:{nr:null,name:'Barolo Cannubi Brezza 2017',cellars:1,bottles:1},reason:'Likt navn og produsent'}
  ],
  activity: [
    {t:'I dag 09:14',who:'u1',what:'Tok ut 1 × Rioja Alta Gran Reserva 904',kind:'ut'},
    {t:'I dag 08:02',who:'admin',what:'Inviterte ingrid@example.no',kind:'admin'},
    {t:'I går 21:40',who:'u2',what:'Satte inn 2 × Charles Heidsieck Brut Réserve',kind:'inn'},
    {t:'I går 18:11',who:'u6',what:'Koblet strekkode 3760062190017 → 4469601',kind:'ean'},
    {t:'22. sep',who:'u3',what:'Satte inn 6 × Paolo Scavino Barolo Cannubi',kind:'inn'},
    {t:'20. sep',who:'admin',what:'Nullstilte passord for per.hansen@example.no',kind:'admin'},
    {t:'3. jul',who:'admin',what:'Deaktiverte lars.moe@example.no',kind:'admin'}
  ],
  api: {status:'ok',latency:182,calls24h:1240,errors24h:3,quota:'25 000 / dag',lastError:'429 Too Many Requests · I går 22:03',lastSync:'I dag 03:00'},
  scansPerDay: [18,24,11,30,42,27,35,22,19,48,31,26,39,44]
};
