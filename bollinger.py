import json, sys
sys.path.append(".")
import pandas as pd


file = open("./config.json")

config= json.load(file)
# print(config)

#get now timestamp 
front_leg = config["FRONT_LEG"]
middle_leg = config["MID_LEG"]
back_leg = config["BACK_LEG"]
tf = config["TF"]

lookback = config["LOOKBACK"]
std_dev = config["STD_DEV"]
sl_std_dev = 1 #default is 1 standard deviation below and above bands

front_vector = config["FRONT_VECTOR"]
middle_vector = config["MIDDLE_VECTOR"]
back_vector = config["BACK_VECTOR"]

moving_average = None
lower_band = None
upper_band = None
long_sl_band = None
short_sl_band = None

test_timestamp = config["TEST_TIMESTAMP"]

def bollinger(df):
    # print("running bollingers...")

    # Moving Average and Moving Standard Deviation
    df['moving_average'] = df.spread.rolling(lookback).mean()
    df['moving_std_dev'] = df.spread.rolling(lookback).std()

    # Upper band and lower band
    df['upper_band'] = df["moving_average"] + std_dev*df["moving_std_dev"] 
    df['lower_band'] = df["moving_average"] - std_dev*df["moving_std_dev"] 

    #short entry and exit
    df["short_entry"]= df.spread >= df.upper_band
    df["short_exit"]= df.spread <= df.moving_average

    #long entry and exit
    df["long_entry"] = df.spread <= df.lower_band
    df["long_exit"] = df.spread >= df.moving_average

    # Add a long position stop loss band x standard deviation away from lower band.
    df['long_sl_band'] = df.lower_band - (sl_std_dev*df.moving_std_dev)
    # Add a short position stop loss x standard deviation away from upper band.
    df['short_sl_band'] = df.upper_band + (sl_std_dev*df.moving_std_dev)
    
    # print(df[['spread','moving_average',"lower_band",'upper_band', "long_sl_band", "short_sl_band"]].iloc[-2:])
 
    global moving_average
    global lower_band
    global upper_band
    global long_sl_band
    global short_sl_band

    moving_average = float(df['moving_average'].iloc[-1])
    lower_band = float(df['lower_band'].iloc[-1])
    upper_band = float(df['upper_band'].iloc[-1])
    long_sl_band = float(df['long_sl_band'].iloc[-1])
    short_sl_band = float(df['short_sl_band'].iloc[-1])

    # print(f"\nCurrent Cointegrated Spread for {tf} = {front_vector}*{front_leg} + ({middle_vector})*{middle_leg} + ({back_vector})*{back_leg}")
    
    # print(f'the {tf} market spread is at {df["spread"][-1]}')
    
    output_string = [{
        "moving_average": moving_average, 
        "lower_band": lower_band, 
        "upper_band" : upper_band, 
        "long_sl_band":long_sl_band, 
        "short_sl_band":short_sl_band
        }]
    output_string = json.dumps(output_string)
    return [output_string, df]

# print(sys.argv)
# print(type(sys.argv))
# print(len(sys.argv))
# json_reread = json.loads(sys.argv[0])
# outputted_df = pd.DataFrame.from_dict(json_reread, orient="index")

test_df = pd.read_json(sys.argv[1])

# print(f'python file read, json turned to dataframe. Tail output is \n {test_df.tail()}')

tuple_returned = bollinger(test_df)
# print('printing bollinger df...')
# print(f'\n {tuple_returned[0].tail()}')
# print('printing output of py script...')
# print(f'\n {tuple_returned[1]}')

#https://dev.to/lawcia/node-vs-python-here-s-how-you-can-use-spawn-to-run-both-in-your-project-109m
# https://www.geeksforgeeks.org/sys-stdout-write-in-python/

sys.stdout.write(tuple_returned[0])

exportable_df = tuple_returned[1]

exportable_df.to_csv(f'./data/{test_timestamp}_{tf}_running.csv')