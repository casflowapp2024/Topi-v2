//components
import { formatMoney, capitalizeWords, formatDate, parseDatetimetoDateStrFormat, parseDatetoDatetimeBrow } from "../helpers";
import { Emoji } from "emoji-picker-react";
import FormatMoneyShowDecs from "../FormatMoneyShowDecs";
const TransSumm = ({
    detailInfo,
    create = false
}) => {

    return (
        <div className="flex flex-col justify-center items-center w-full" >
            {/* title and close */}
            <div class="flex justify-between mb-4 rounded-t sm:mb-5 w-full">
                <div class="w-[98%] text-lg text-gray-900 md:text-xl dark:text-white text-center">
                    <h3 class="font-semibold ">
                        {detailInfo.description && detailInfo.description}
                    </h3>
                    <p class="font-bold">
                        {detailInfo.expense === false ?
                            <span className=' text-xl text-emerald-600 '>
                                +<FormatMoneyShowDecs
                                    numb={detailInfo.amount && detailInfo.amount}
                                    currency={detailInfo.currency}
                                    base={detailInfo.amount_base}
                                    showDecimals={true}
                                    intClass="text-xl"
                                    decClass="text-sm"
                                />
                            </span>
                            :
                            <span className=' text-xl text-red-600'>
                                -<FormatMoneyShowDecs
                                    numb={detailInfo.amount && detailInfo.amount}
                                    currency={detailInfo.currency}
                                    base={detailInfo.amount_base}
                                    showDecimals={true}
                                    intClass="text-xl"
                                    decClass="text-sm"
                                />
                            </span>
                        }
                    </p>
                </div>

            </div>
            {/* detalle */}
            <dl className="w-full">
                <dt class="mb-2 font-semibold leading-none text-gray-900 dark:text-white">Categoria</dt>
                <dd class="mb-4 font-light text-gray-500 sm:mb-5 dark:text-gray-400 flex flex-row gap-2">
                    {detailInfo.category && detailInfo.category.emoji &&
                        <Emoji unified={detailInfo.category.emoji.toLowerCase()} emojiStyle="apple" size={20} />
                    }
                    {capitalizeWords(detailInfo.category && detailInfo.category.name)}
                </dd>
                <dt class="mb-2 font-semibold leading-none text-gray-900 dark:text-white mt-4">Detalles</dt>
                <dd class="mb-2 font-light text-gray-500 sm:mb-2 dark:text-gray-400 flex flex-col">

                    <span>Fecha: {parseDatetimetoDateStrFormat(parseDatetoDatetimeBrow(detailInfo.date && detailInfo.date, "YYYY-MM-DD HH:mm:ss Z"), "DD-MM-YYYY")}</span>

                    <span>Producto: {detailInfo.account && detailInfo.account.name} - {detailInfo.account && detailInfo.account.last_four_digits}</span>

                    {detailInfo.transfer_group_id ?
                        <span> Tipo: Transferencia ({detailInfo.expense === false ? 'entrada' : 'salida'})</span>
                        : detailInfo.expense === false ?
                            <span> Tipo: Ingreso</span>
                            :
                            <span> Tipo: Gasto</span>
                    }
                    {create ?
                        <></>
                        :
                        <div className='mt-4 font-bold text-xs'>
                            {detailInfo.automated === false ?
                                <span> Transacción ingresada manualmente</span>
                                :
                                <span> Transacción registrada automaticamente</span>
                            }
                        </div>
                    }
                    {detailInfo.should_verify !== true ?
                        <></>
                        :
                        <p className="mt-3 text-xs text-center bg-yellow-50 border-t-4 border-yellow-300 py-1 px-2 inline-block">
                            <span className="inline-flex items-center gap-2">
                                <Emoji unified="1f4a1" emojiStyle="apple" size={16} />
                                <span className="text-yellow-800">
                                    Verifica esta transacción. No estamos seguros de la cuenta.
                                </span>
                            </span>
                        </p>
                    }
                </dd>

            </dl>
        </div >
    )
}



export default TransSumm
