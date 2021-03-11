import React, {useState, useEffect} from "react";
import {CardElement, useStripe, useElements} from "@stripe/react-stripe-js";
import {useSelector, useDispatch} from "react-redux";
import {createPaymentIntent} from "../functions/stripe";
import {Link} from "react-router-dom";
import {Card} from 'antd'
import {DollarOutlined, CheckOutlined} from "@ant-design/icons";
import stripeImage from '../images/stripe.png'
import {createOrder, emptyUserCart} from "../functions/user";


const StripeCheckout = ({history}) => {
    const dispatch = useDispatch()
    const {user, coupon} = useSelector((state) => ({...state}))

    const [succeeded, setSucceeded] = useState(false)
    const [error, setError] = useState(null)
    const [processing, setProcessing] = useState(false)
    const [disabled, setDisabled] = useState(true)
    const [clientSecret, setClientSecret] = useState('')

    const [cartTotal, setCartTotal] = useState(0)
    const [totalAfterDiscount, setTotalAfterDiscount]= useState(0)
    const [payable, setPayable] = useState(0)

    const stripe = useStripe();
    const elements = useElements();

    useEffect(() => {
        createPaymentIntent(user.token, coupon)
            .then((res) => {
                console.log("PAYMENT INTENT RESPONSE", res.data)
                setClientSecret(res.data.clientSecret)
                //additional response received on payment
                setCartTotal(res.data.cartTotal)
                setTotalAfterDiscount(res.data.totalAfterDiscount)
                setPayable(res.data.payable)
            })
    }, [])

    const cartStyle = {
        style: {
            base: {
                color: "#32325d",
                fontFamily: "Arial, sans-serif",
                fontSmoothing: "antialiased",
                fontSize: "16px",
                "::placeholder": {
                    color: "#32325d",
                },
            },
            invalid: {
                color: "#fa755a",
                iconColor: "#fa755a",
            },
        },
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setProcessing(true)

        const payload = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card : elements.getElement(CardElement),
                billing_details: {
                    name: e.target.name.value,
                }
            }
        })

        if(payload.error) {
            setError(`Payment failed ${payload.error.message}`)
            setProcessing(false)
        } else {
            //here you get result after successful payment
            //create order and save in database fro admin to process
            createOrder(payload, user.token)
                .then((res) => {
                    if(res.data.ok) {
                        //empty user cart from local storage
                        if(typeof window !== "undefined") localStorage.removeItem("cart")
                        //empty user cart from redux store
                        dispatch({
                            type : "ADD_TO_CART",
                            payload : [],
                        })
                        //reset coupon to false
                        dispatch({
                            type : "COUPON_APPLIED",
                            payload : false,
                        })
                        //empty cart from backend
                        emptyUserCart(user.token);
                    }
                })
            console.log('PAYLOAD', JSON.stringify(payload, null, 4))
            setError(null)
            setProcessing(false);
            setSucceeded(true);

        }

    }

    const handleChange = async (e) => {
        //listen for changes in the card element and display any
        //errors as the customer types their card details
        setDisabled(e.empty)
        setError(e.error ? e.error.message : "")
    }

    return (
        <>
            {!succeeded && <div>
                {coupon && totalAfterDiscount !== undefined ?
                    (<p className={"alert alert-success"}>{`Total after discount : Rs. ${totalAfterDiscount}`}</p>) :
                    (<p className={"alert alert-danger"}>No coupon applied</p>)}
            </div>}

            <div className={"text-center pb-5"}>
                <Card cover={<img
                    src={stripeImage} style={{
                    height : "150px",
                    objectFit : "cover",
                    marginBottom : "-50px",
                }}/>}
                      actions={[
                          <>
                              <br/>
                              <DollarOutlined className={"text-info"}/> <br/>
                              Total: Rs. {cartTotal.toFixed(2)}
                          </>,
                          <>
                              <br/>
                              <CheckOutlined className={"text-info"}/> <br/>
                              Total payable: Rs. {(payable/100).toFixed(2)}
                          </>,
                      ]}
                />
            </div>

            <form id={"payment-form"} className={"stripe-form"}
            onSubmit={handleSubmit}>

                <CardElement id={"card-element"} options={cartStyle}
                onChange={handleChange}/>

                <button className={"stripe-button"}
                        disabled={processing || disabled || succeeded}>
                    <span id={"button-text"}>
                        {processing ? <div className={"spinner"} id={"spinner"}> </div> :
                        "Pay"}
                    </span>
                </button> <br/>

                {error && <div className={"card-error"} role={"alert"}>{error}</div> }

                <p className={succeeded ? 'result-message' : 'result-message hidden'}>
                    Payment Successful! <br/>  <Link to={"/user/history"}>See the order in My Orders Section</Link> </p>

            </form>



        </>
    )
}

export default StripeCheckout


