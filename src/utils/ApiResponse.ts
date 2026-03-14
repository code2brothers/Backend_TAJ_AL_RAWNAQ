class ApiResponse<T = any> {
    public success: boolean;
    constructor(
        public statusCode: number,
        public data: T,
        public message: string = "Success"
    ) {
        this.success = statusCode < 400;
    }
}

// it auto add to this which come in constructor
// class ApiResponse{
//
//     public statusCode
//     public message
//     public data
//     public success
//     constructor(statusCode:number , data:any, message="Success") {
//           this.statusCode = statusCode
//           this.data = data
//           this.message = message
//           this.success = statusCode<400
//     }
// }




export {ApiResponse}