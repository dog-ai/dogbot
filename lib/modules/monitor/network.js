/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function network() {
    var moduleManager = {};
}

network.prototype.type = "MONITOR";

network.prototype.name = "network";

network.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

network.prototype.load = function(moduleManager) {
    var self = this;
    this.moduleManager = moduleManager;


    setTimeout(function() {
        self.start()
    }, 10000);
}

network.prototype.unload = function() {}

network.prototype.start = function() {
    var hugo = ['active',
        'subCategory',
        'unspscCode',
        'description',
        'manufacturer',
        'manufacturerProductNumber',
        'gs1Code',
        'productFamily',
        'modelName',
        'color',
        'artist',
        'title',
        'isbn10',
        'asin',
        'media',
        'departureCountry',
        'destinationCountry',
        'departureCity',
        'destinationCity',
        'departureAirport',
        'departureAirportCode',
        'destinationAirport',
        'destinationAirportCode',
        'carrier',
        'hotelName',
        'hotelGrade',
        'hotelGradeString',
        'departureDate',
        'returnDate',
        'journeyLengthDays',
        'journeyLengthWeeks',
        'onPromotion',
        'promotionCode',
        'promotionName',
        'selectMe',
        'targets',
        'priceWithoutTax',
        'originalPriceWithTax',
        'originalPriceWithoutTax',
        'shippingCostWithTax',
        'shippingCostWithoutTax',
        'priceWithShippingCostAndTax',
        'targetCpaValue',
        'targetCpaPercent',
        'quantityForSale',
        'inStock',
        'availableFromDate',
        'availableToDate',
        'reviewRank',
        'priceComparisonRank',
        'imageUrl',
        'categoryUrl',
        'subCategoryUrl',
        'customUrl1',
        'customUrl2',
        'customUrl3',
        'keywords',
        'negativeKeywords',
        'adCopyText1',
        'adCopyText2',
        'adCopyText3',
        'adCopyText4',
        'customText1',
        'customText2',
        'customText3',
        'customNum1',
        'customNum2',
        'customNum3',
        'lastUpdated',
        'subCategory2',
        'subCategory3',
        'ean',
        'size',
        'gender',
        'newItem',
        'releaseDate',
        'subCategory2Url',
        'subCategory3Url',
        'manufacturerUrl',
        'productFamilyUrl',
        'imageUrlBig',
        'salesStat',
        'productMargin'
    ];

hugo.forEach(function(property) {
    console.log("INSERT INTO core.product_transformation (type) VALUES ('DEFAULT');");
    console.log("INSERT INTO core.product_transformation_default (id, provider) VALUES (LAST_INSERT_ID(), 'FEEDEO');");
    console.log("INSERT INTO core.product_transformation_default_feedeo (id, property, transformation) VALUES (LAST_INSERT_ID(), '" + property + "', '');");
    console.log("INSERT INTO core.product_feed_transformation_product_transformation (product_feed_transformation, product_transformation) VALUES (@pftd, LAST_INSERT_ID());");

});
}

module.exports = new network();
