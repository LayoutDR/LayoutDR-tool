var include = '';



include += '<a href="https://getsentry.com/welcome/">';
include += '<img width="130px" src="https://fund-rest-framework.s3.amazonaws.com/sentry130.png"></img>';
include += '</a>';


include += '<p><a class="promo" href="https://getsentry.com/welcome/">Sentry provides real-time crash reporting for your web apps, mobile apps, and games.</a></p>';



include += '<p><a href="https://fund.django-rest-framework.org/topics/funding/">Fund Django REST framework</a></p>'

document.getElementById('sidebarInclude').innerHTML = include;
