/**
 * demo.js
 * http://www.codrops.com
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 * 
 * Copyright 2017, Codrops
 * http://www.codrops.com
 */
// var aA = document.getElementsByClassName('demo');
// var len = aA.length;
// var iniIndex=0;
// for(var i=0;i<len;i++){
// 	console.log(hasClass(aA[i],'demo--current'));
// 	aA[i].onmouseover = function () {
// 		for(var j=0;j<len;j++){
//             aA[j].classList.remove('demo--current');
// 		}
// 		this.classList.add('demo--current');
//     }
// }
// function hasClass(obj, cls){
//     var obj_class = obj.className,//获取 class 内容.
//         obj_class_lst = obj_class.split(/\s+/);//通过split空字符将cls转换成数组.
//     x = 0;
//     for(x in obj_class_lst) {
//         if(obj_class_lst[x] == cls) {//循环数组, 判断是否包含cls
//             return true;
//         }
//     }
//     return false;
// }
{
	setTimeout(() => document.body.classList.add('render'), 60);
	const navdemos = Array.from(document.querySelectorAll('nav.demos > .demo'));
	const total = navdemos.length;
	const current = navdemos.findIndex(el => el.classList.contains('demo--current'));
	const navigate = (linkEl) => {
		document.body.classList.remove('render');
		document.body.addEventListener('transitionend', () => window.location = linkEl.href);
	};
	navdemos.forEach(link => link.addEventListener('click', (ev) => {
		ev.preventDefault();
		navigate(ev.target);
	}));
	/*
	document.addEventListener('keydown', (ev) => {
		const keyCode = ev.keyCode || ev.which;
		let linkEl;
		if ( keyCode === 37 ) {
			linkEl = current > 0 ? navdemos[current-1] : navdemos[total-1];
		}
		else if ( keyCode === 39 ) {
			linkEl = current < total-1 ? navdemos[current+1] : navdemos[0];
		}
		else {
			return false;
		}
		navigate(linkEl);
	});
	*/
}
