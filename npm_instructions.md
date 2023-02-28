tutorial: https://www.youtube.com/watch?v=J4b_T-qH3BY
cd ../package/
do dev
update version in package json
npm publish --access=public
may need to login
npm login

link package
npm link (in package folder)
then cd to another folder and
npm link package-name
