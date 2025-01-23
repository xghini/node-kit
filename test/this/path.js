import {xpath} from '@ghini/kit/dev'
import { resolve, join, normalize } from "path";

console.log(resolve("./")); //process.cwd()
console.log(resolve("../")); //process.cwd()
console.log(resolve("../../../../")); //process.cwd()
console.log(join("/base", "path/../../../../.."));
console.log(normalize("file:///c:/base"));
console.log(normalize("file:///c/base"));
console.log("===============");
console.log(xpath("happy",'..'));
console.log(xpath("happy",'../'));
console.log(xpath("happy",'../../what'));