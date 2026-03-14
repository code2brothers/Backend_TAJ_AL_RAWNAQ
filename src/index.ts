import {app} from "./app.js";
import connectDB from "./database/connectDB.js";


connectDB().then(()=>{
    app.listen(process.env.PORT ||8000,()=>{
        console.log(`Server is running at port ${process.env.PORT}`)
    })
})
.catch( (err)=> {
 console.log("MongoDB connection Failed ",err)
})