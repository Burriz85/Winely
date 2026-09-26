window.VINSKAP_DATA = {
  wines: [
    {id:1,name:'Barolo Cannubi',producer:'G. Brezza',year:2017,type:'Rødvin',country:'Italia',region:'Piemonte',grape:'Nebbiolo',abv:'14,5 %',price:689,nr:'1670901',qty:3,from:2024,to:2035,taste:'Kirsebær, roser og tjære. Fast tannin og lang avslutning.',food:'Storfe · Vilt · Lam'},
    {id:2,name:'Chablis 1er Cru Vaillons',producer:'Samuel Billaud',year:2021,type:'Hvitvin',country:'Frankrike',region:'Burgund',grape:'Chardonnay',abv:'12,5 %',price:429,nr:'8354901',qty:2,from:2023,to:2029,taste:'Sitrus, grønt eple og flint. Stram syre.',food:'Skalldyr · Fisk'},
    {id:3,name:'Brut Réserve',producer:'Charles Heidsieck',year:null,type:'Musserende',country:'Frankrike',region:'Champagne',grape:'Pinot Noir, Chardonnay',abv:'12 %',price:599,nr:'3761801',qty:4,from:2024,to:2028,taste:'Brioche, gule epler og nøtter. Kremet mousse.',food:'Aperitiff · Skalldyr'},
    {id:4,name:'Rioja Gran Reserva 904',producer:'La Rioja Alta',year:2015,type:'Rødvin',country:'Spania',region:'Rioja',grape:'Tempranillo',abv:'13,5 %',price:549,nr:'563301',qty:2,from:2023,to:2032,taste:'Tørket kirsebær, vanilje og tobakk.',food:'Lam · Ost'},
    {id:5,name:'Wehlener Sonnenuhr Kabinett',producer:'Dr. Loosen',year:2020,type:'Hvitvin',country:'Tyskland',region:'Mosel',grape:'Riesling',abv:'8 %',price:379,nr:'315201',qty:3,from:2027,to:2040,taste:'Fersken, lime og skifer. Lett sødme.',food:'Asiatisk · Svin'},
    {id:6,name:'Châteauneuf-du-Pape Réservé',producer:'Domaine du Pegau',year:2019,type:'Rødvin',country:'Frankrike',region:'Rhône',grape:'Grenache, Syrah',abv:'14,5 %',price:629,nr:'191401',qty:1,from:2026,to:2038,taste:'Mørke bær, urter og lakris.',food:'Vilt · Storfe'},
    {id:7,name:'Whispering Angel',producer:"Château d'Esclans",year:2023,type:'Rosévin',country:'Frankrike',region:'Provence',grape:'Grenache, Cinsault',abv:'13 %',price:229,nr:'2210601',qty:2,from:2024,to:2026,taste:'Jordbær, fersken og mineraler.',food:'Aperitiff · Salat'}
  ],
  lookup: {id:null,name:'Barolo Cannubi',producer:'Paolo Scavino',year:2019,type:'Rødvin',country:'Italia',region:'Piemonte',grape:'Nebbiolo',abv:'13,5 %',price:989,nr:'1616601',qty:0,from:2027,to:2040,taste:'Kirsebær, jord og krydder. Strukturert.',food:'Fugl · Storfe'},
  log: [
    {id:1,wid:4,dir:'ut',qty:1,t:'I går · 19:42'},
    {id:2,wid:5,dir:'inn',qty:3,t:'12. sep · 14:10'},
    {id:3,wid:2,dir:'ut',qty:1,t:'7. sep · 18:30'},
    {id:4,wid:1,dir:'inn',qty:3,t:'28. aug · 11:05'},
    {id:5,wid:3,dir:'inn',qty:4,t:'28. aug · 11:03'}
  ]
};

(function(){const D=window.VINSKAP_DATA;const im=n=>'https://bilder.vinmonopolet.no/cache/300x300-0/'+n+'-1.jpg';D.wines.forEach(w=>w.img=im(w.nr));D.lookup.img=im(D.lookup.nr);})();
